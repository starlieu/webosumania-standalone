import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BlobReader, BlobWriter, TextReader, TextWriter, ZipReader, ZipWriter } from "@zip.js/zip.js";
import type { FileEntry } from "@zip.js/zip.js";
import { createFileRoute } from "@tanstack/react-router";
import { ArrowLeft, ArrowRight, ArrowUp, Download, FileAudio2, FilePlus2, Music2, Plus, Save, Trash2 } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { useGameStore } from "@/stores/gameStore";

type EditorNote = { id: number; lane: number; time: number; endTime?: number };
type ArchiveEntry = { name: string; blob: Blob };
type EditorMap = {
  title: string;
  artist: string;
  creator: string;
  version: string;
  keys: number;
  bpm: number;
  notes: EditorNote[];
  archive: ArchiveEntry[];
  osuPath: string | null;
  osuText: string | null;
  audioFile: File | null;
};

const freshMap = (): EditorMap => ({
  title: "Untitled",
  artist: "Unknown Artist",
  creator: "Mapper",
  version: "Normal",
  keys: 4,
  bpm: 120,
  notes: [],
  archive: [],
  osuPath: null,
  osuText: null,
  audioFile: null,
});

const sectionBody = (text: string, section: string) => {
  const match = text.match(new RegExp(`\\[${section}\\]\\r?\\n([\\s\\S]*?)(?=\\r?\\n\\[|$)`));
  return match?.[1] ?? "";
};

const readField = (text: string, section: string, field: string, fallback: string) => {
  const line = sectionBody(text, section).split(/\r?\n/).find((item) => item.startsWith(`${field}:`));
  return line?.slice(field.length + 1).trim() || fallback;
};

const replaceField = (text: string, section: string, field: string, value: string) => {
  const sectionRegex = new RegExp(`(\\[${section}\\]\\r?\\n)([\\s\\S]*?)(?=\\r?\\n\\[|$)`);
  return text.replace(sectionRegex, (_whole, header: string, body: string) => {
    const fieldRegex = new RegExp(`^${field}:.*$`, "m");
    const nextBody = fieldRegex.test(body)
      ? body.replace(fieldRegex, () => `${field}:${value}`)
      : `${body.trimEnd()}\n${field}:${value}`;
    return `${header}${nextBody}`;
  });
};

const parseMapText = (text: string) => {
  const keys = Math.max(1, Math.min(10, Math.round(Number(readField(text, "Difficulty", "CircleSize", "4")) || 4)));
  const timingPoint = sectionBody(text, "TimingPoints").split(/\r?\n/).map((line) => line.split(",")).find((parts) => Number(parts[1]) > 0 && (parts[6] === undefined || parts[6] === "1"));
  const bpm = timingPoint ? Math.max(1, Math.min(1000, 60000 / Number(timingPoint[1]))) : 120;
  const notes: EditorNote[] = [];
  let id = 1;

  for (const line of sectionBody(text, "HitObjects").split(/\r?\n/)) {
    if (!line.trim()) continue;
    const parts = line.split(",");
    const x = Number(parts[0]);
    const time = Number(parts[2]);
    const type = Number(parts[3]);
    if (!Number.isFinite(time) || !Number.isFinite(x)) continue;
    const lane = Math.max(0, Math.min(keys - 1, Math.floor((x * keys) / 512)));
    if (type & 128) {
      const endTime = Number(parts[5]?.split(":")[0]);
      notes.push({ id: id++, lane, time, endTime: Number.isFinite(endTime) && endTime > time ? endTime : time + 250 });
    } else if (type & 1) {
      notes.push({ id: id++, lane, time });
    }
  }

  return {
    title: readField(text, "Metadata", "Title", "Untitled"),
    artist: readField(text, "Metadata", "Artist", "Unknown Artist"),
    creator: readField(text, "Metadata", "Creator", "Mapper"),
    version: readField(text, "Metadata", "Version", "Normal"),
    keys,
    bpm,
    notes: notes.sort((a, b) => a.time - b.time || a.lane - b.lane),
  };
};

const noteObjects = (notes: EditorNote[], keys: number) =>
  notes
    .slice()
    .sort((a, b) => a.time - b.time || a.lane - b.lane)
    .map((note) => {
      const x = Math.round(((note.lane + 0.5) * 512) / keys);
      return note.endTime
        ? `${x},192,${Math.round(note.time)},128,0,${Math.round(note.endTime)}:0:0:0:0:`
        : `${x},192,${Math.round(note.time)},1,0,0:0:0:0:`;
    })
    .join("\n");

const createOsuFile = (map: EditorMap) => {
  const audioName = map.audioFile?.name.replace(/[\\/:*?"<>|]/g, "_") ?? "";
  return `osu file format v14\n\n[General]\nAudioFilename: ${audioName}\nAudioLeadIn: 0\nPreviewTime: -1\nCountdown: 0\nSampleSet: Normal\nStackLeniency: 0.7\nMode: 3\nLetterboxInBreaks: 0\nWidescreenStoryboard: 0\n\n[Editor]\nDistanceSpacing: 1\nBeatDivisor: 4\nGridSize: 4\nTimelineZoom: 1\n\n[Metadata]\nTitle:${map.title}\nTitleUnicode:${map.title}\nArtist:${map.artist}\nArtistUnicode:${map.artist}\nCreator:${map.creator}\nVersion:${map.version}\nSource:\nTags: offline editor\nBeatmapID:0\nBeatmapSetID:0\n\n[Difficulty]\nHPDrainRate:5\nCircleSize:${map.keys}\nOverallDifficulty:8\nApproachRate:5\nSliderMultiplier:1.4\nSliderTickRate:1\n\n[Events]\n//Background and video events\n//Break Periods\n//Storyboard Layer 0 (Background)\n//Storyboard Layer 1 (Fail)\n//Storyboard Layer 2 (Pass)\n//Storyboard Layer 3 (Foreground)\n//Storyboard Sound Samples\n\n[TimingPoints]\n0,${(60000 / map.bpm).toFixed(6)},4,2,0,100,1,0\n\n[HitObjects]\n${noteObjects(map.notes, map.keys)}\n`;
};

export const Route = createFileRoute("/editor")({ component: MapEditor });

function MapEditor() {
  const [map, setMap] = useState<EditorMap>(freshMap);
  const [tool, setTool] = useState<"tap" | "hold">("tap");
  const [division, setDivision] = useState(4);
  const [barOffset, setBarOffset] = useState(0);
  const [holdStart, setHoldStart] = useState<{ lane: number; time: number } | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const audioInput = useRef<HTMLInputElement>(null);
  const setUploadedBeatmapSet = useGameStore.use.setUploadedBeatmapSet();

  const update = (partial: Partial<EditorMap>) => setMap((current) => ({ ...current, ...partial }));
  const beatLength = 60000 / map.bpm;
  const rowsPerBar = 4 * division;
  const visibleRows = rowsPerBar * 4;
  const visibleStart = barOffset * 4 * beatLength;
  const rowDuration = beatLength / division;
  const visibleEnd = visibleStart + visibleRows * rowDuration;

  const loadArchive = async (file: File) => {
    setIsBusy(true);
    try {
      const reader = new ZipReader(new BlobReader(file));
      const entries = await reader.getEntries();
      const osuEntry = entries.find((entry): entry is FileEntry => !entry.directory && entry.filename.endsWith(".osu"));
      if (!osuEntry) throw new Error("Aucun fichier .osu trouvé dans cette archive.");
      const text = await osuEntry.getData(new TextWriter());
      const archive: ArchiveEntry[] = [];
      for (const entry of entries) {
        if (entry.directory) continue;
        const data = await entry.getData(new BlobWriter());
        if (data) archive.push({ name: entry.filename, blob: data });
      }
      const parsed = parseMapText(text);
      setMap((current) => ({ ...current, ...parsed, osuPath: osuEntry.filename, osuText: text, archive, audioFile: null }));
      setBarOffset(0);
      setHoldStart(null);
      toast.success(`Difficulté chargée : ${parsed.notes.length} notes`);
      await reader.close();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Impossible d'ouvrir cette map.");
    } finally {
      setIsBusy(false);
    }
  };

  const addNote = (lane: number, row: number) => {
    const time = Math.round((visibleStart + row * rowDuration) / rowDuration) * rowDuration;
    if (tool === "hold") {
      if (!holdStart) {
        setHoldStart({ lane, time });
        return;
      }
      if (holdStart.lane !== lane) {
        setHoldStart({ lane, time });
        return;
      }
      const start = Math.min(holdStart.time, time);
      const end = Math.max(holdStart.time, time);
      if (end <= start) {
        toast("Choisis une ligne plus basse pour terminer le hold.");
        return;
      }
      setMap((current) => ({ ...current, notes: [...current.notes, { id: Date.now(), lane, time: start, endTime: end }] }));
      setHoldStart(null);
      return;
    }
    setMap((current) => {
      const existing = current.notes.find((note) => note.lane === lane && Math.abs(note.time - time) < rowDuration / 3);
      return { ...current, notes: existing ? current.notes.filter((note) => note.id !== existing.id) : [...current.notes, { id: Date.now() + lane, lane, time }] };
    });
  };

  const exportFile = async (install: boolean) => {
    if (!map.title.trim() || !map.artist.trim() || !map.creator.trim()) {
      toast.error("Renseigne le titre, l'artiste et le mapper.");
      return;
    }
    if (!map.notes.length) {
      toast.error("Ajoute au moins une note avant d'exporter la map.");
      return;
    }
    setIsBusy(true);
    try {
      const zipWriter = new ZipWriter(new BlobWriter("application/zip"));
      let osuText = map.osuText ?? createOsuFile(map);
      if (map.osuText) {
        osuText = replaceField(osuText, "Metadata", "Title", map.title);
        osuText = replaceField(osuText, "Metadata", "TitleUnicode", map.title);
        osuText = replaceField(osuText, "Metadata", "Artist", map.artist);
        osuText = replaceField(osuText, "Metadata", "ArtistUnicode", map.artist);
        osuText = replaceField(osuText, "Metadata", "Creator", map.creator);
        osuText = replaceField(osuText, "Metadata", "Version", map.version);
        osuText = replaceField(osuText, "Difficulty", "CircleSize", String(map.keys));
        const timing = sectionBody(osuText, "TimingPoints").split(/\r?\n/);
        const firstRedLine = timing.findIndex((line) => Number(line.split(",")[1]) > 0 && line.split(",")[6] !== "0");
        if (firstRedLine >= 0) {
          const timingFields = timing[firstRedLine].split(",");
          timingFields[1] = (60000 / map.bpm).toFixed(6);
          timing[firstRedLine] = timingFields.join(",");
          osuText = osuText.replace(sectionBody(osuText, "TimingPoints"), timing.join("\n"));
        }
        const hitObjects = noteObjects(map.notes, map.keys);
        const hitObjectRegex = /(\[HitObjects\]\r?\n)[\s\S]*?(?=\r?\n\[|$)/;
        osuText = hitObjectRegex.test(osuText) ? osuText.replace(hitObjectRegex, `$1${hitObjects}`) : `${osuText.trimEnd()}\n\n[HitObjects]\n${hitObjects}\n`;
      }

      if (map.archive.length > 0 && map.osuPath) {
        for (const entry of map.archive) {
          await zipWriter.add(entry.name, entry.name === map.osuPath ? new TextReader(osuText) : new BlobReader(entry.blob));
        }
      } else {
        const folder = `${map.artist} - ${map.title}`.replace(/[\\/:*?"<>|]/g, "_");
        const filename = `${map.title} (${map.creator}) [${map.version}]`.replace(/[\\/:*?"<>|]/g, "_");
        await zipWriter.add(`${folder}/${filename}.osu`, new TextReader(osuText));
        if (map.audioFile) {
          const safeAudioName = map.audioFile.name.replace(/[\\/:*?"<>|]/g, "_");
          await zipWriter.add(`${folder}/${safeAudioName}`, new BlobReader(map.audioFile));
        }
      }

      const blob = await zipWriter.close();
      const safeName = `${map.artist} - ${map.title}`.replace(/[\\/:*?"<>|]/g, "_");
      const file = new File([blob], `${safeName}.osz`, { type: "application/zip" });
      if (install) {
        await setUploadedBeatmapSet(file);
        toast.success("Map installée dans ta bibliothèque locale.");
      } else {
        const url = URL.createObjectURL(file);
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = file.name;
        anchor.click();
        URL.revokeObjectURL(url);
        toast.success("Fichier .osz exporté.");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Échec de l'export.");
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-7xl px-3 py-6 sm:px-6">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4 border-b pb-4">
        <div>
          <div className="mb-1 flex items-center gap-2 text-sm text-muted-foreground"><Music2 className="size-4" /> MANIA MAP EDITOR</div>
          <h1 className="text-2xl font-semibold">Éditeur de beatmap</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <input ref={fileInput} type="file" accept=".osz" className="hidden" onChange={(event) => { const file = event.currentTarget.files?.[0]; event.currentTarget.value = ""; if (file) void loadArchive(file); }} />
          <Button variant="outline" onClick={() => fileInput.current?.click()} disabled={isBusy}><FilePlus2 className="mr-2 size-4" />Ouvrir .osz</Button>
          <Button variant="outline" onClick={() => { setMap(freshMap()); setBarOffset(0); setHoldStart(null); }}><Plus className="mr-2 size-4" />Nouvelle map</Button>
          <Button variant="secondary" onClick={() => void exportFile(false)} disabled={isBusy}><Download className="mr-2 size-4" />Exporter .osz</Button>
          <Button onClick={() => void exportFile(true)} disabled={isBusy}><Save className="mr-2 size-4" />Installer & jouer</Button>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[300px_minmax(0,1fr)]">
        <aside className="space-y-4 border-b pb-5 xl:border-b-0 xl:border-r xl:pr-5">
          <div className="space-y-3">
            <label className="block text-sm font-medium">Titre<Input className="mt-1" value={map.title} onChange={(event) => update({ title: event.target.value })} /></label>
            <label className="block text-sm font-medium">Artiste<Input className="mt-1" value={map.artist} onChange={(event) => update({ artist: event.target.value })} /></label>
            <label className="block text-sm font-medium">Mapper<Input className="mt-1" value={map.creator} onChange={(event) => update({ creator: event.target.value })} /></label>
            <label className="block text-sm font-medium">Difficulté<Input className="mt-1" value={map.version} onChange={(event) => update({ version: event.target.value })} /></label>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="text-sm font-medium">BPM<Input className="mt-1" type="number" min={1} max={1000} value={map.bpm} onChange={(event) => update({ bpm: Math.max(1, Number(event.target.value) || 1) })} /></label>
            <label className="text-sm font-medium">Colonnes<select className="border-input bg-background mt-1 h-9 w-full rounded-md border px-2" value={map.keys} onChange={(event) => { const keys = Number(event.target.value); update({ keys, notes: map.notes.map((note) => ({ ...note, lane: Math.min(note.lane, keys - 1) })) }); }}><option value={4}>4K</option><option value={5}>5K</option><option value={6}>6K</option><option value={7}>7K</option><option value={8}>8K</option></select></label>
          </div>
          {!map.osuText && <div className="rounded-md border border-dashed p-3">
            <input ref={audioInput} type="file" accept="audio/*,.mp3,.ogg,.wav" className="hidden" onChange={(event) => update({ audioFile: event.currentTarget.files?.[0] ?? null })} />
            <Button variant="outline" className="w-full" onClick={() => audioInput.current?.click()}><FileAudio2 className="mr-2 size-4" />{map.audioFile ? map.audioFile.name : "Ajouter un audio"}</Button>
            <p className="mt-2 text-xs text-muted-foreground">Facultatif pour les maps neuves. Sans audio, le jeu crée une piste silencieuse.</p>
          </div>}
          {map.osuText && <p className="text-xs text-muted-foreground">Difficulté importée. Les autres fichiers de l’archive (audio, images et autres difficultés) seront conservés à l’export.</p>}
          <div className="flex items-center justify-between border-t pt-3 text-sm"><span className="text-muted-foreground">Notes placées</span><span className="font-mono font-semibold">{map.notes.length}</span></div>
          {holdStart && <p className="text-sm text-amber-500">Choisis la fin du hold sur la même colonne.</p>}
        </aside>

        <section className="min-w-0">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-1">
              <Button size="icon" variant="outline" aria-label="Mesure précédente" onClick={() => setBarOffset(Math.max(0, barOffset - 4))}><ArrowLeft className="size-4" /></Button>
              <span className="min-w-32 text-center font-mono text-sm">Mesures {barOffset + 1}–{barOffset + 4}</span>
              <Button size="icon" variant="outline" aria-label="Mesures suivantes" onClick={() => setBarOffset(barOffset + 4)}><ArrowRight className="size-4" /></Button>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant={tool === "tap" ? "default" : "outline"} onClick={() => { setTool("tap"); setHoldStart(null); }}>Tap</Button>
              <Button size="sm" variant={tool === "hold" ? "default" : "outline"} onClick={() => { setTool("hold"); setHoldStart(null); }}>Hold</Button>
              <select className="border-input bg-background h-9 rounded-md border px-2 text-sm" value={division} onChange={(event) => setDivision(Number(event.target.value))}><option value={1}>1/4</option><option value={2}>1/8</option><option value={4}>1/16</option></select>
              <Button size="sm" variant="outline" onClick={() => setMap((current) => ({ ...current, notes: current.notes.slice(0, -1) }))} disabled={!map.notes.length}><ArrowUp className="mr-1 size-4" />Annuler</Button>
              <Button size="sm" variant="outline" onClick={() => setMap((current) => ({ ...current, notes: [] }))} disabled={!map.notes.length}><Trash2 className="mr-1 size-4" />Tout effacer</Button>
            </div>
          </div>

          <div className="overflow-auto rounded-md border bg-black/20">
            <div className="min-w-[520px]">
              <div className="grid border-b bg-card" style={{ gridTemplateColumns: `44px repeat(${map.keys}, minmax(0, 1fr))` }}>
                <div className="p-2 text-center text-xs text-muted-foreground">sec</div>
                {Array.from({ length: map.keys }, (_, lane) => <div key={lane} className="border-l p-2 text-center text-xs font-semibold">{lane + 1}</div>)}
              </div>
              <div className="relative">
                {Array.from({ length: visibleRows }, (_, row) => {
                  const time = visibleStart + row * rowDuration;
                  const isBeat = row % division === 0;
                  const isBar = row % rowsPerBar === 0;
                  return <div key={row} className={`grid h-7 ${isBar ? "border-t-2 border-primary/60" : isBeat ? "border-t border-white/20" : "border-t border-white/5"}`} style={{ gridTemplateColumns: `44px repeat(${map.keys}, minmax(0, 1fr))` }}>
                    <div className="flex items-center justify-center text-[10px] tabular-nums text-muted-foreground">{isBeat ? (time / 1000).toFixed(1) : ""}</div>
                    {Array.from({ length: map.keys }, (_, lane) => {
                      const note = map.notes.find((item) => item.lane === lane && item.time >= time - rowDuration / 2 && item.time < time + rowDuration / 2);
                      const activeHold = map.notes.find((item) => item.lane === lane && item.endTime && item.time < time && item.endTime >= time);
                      const pending = holdStart?.lane === lane && Math.abs(holdStart.time - time) < rowDuration / 2;
                      return <button key={lane} type="button" aria-label={`Colonne ${lane + 1}, ${(time / 1000).toFixed(2)} secondes`} onClick={() => addNote(lane, row)} className={`relative border-l border-white/10 ${note ? "bg-cyan-300/80" : activeHold ? "bg-cyan-300/30" : pending ? "bg-amber-400/50" : "hover:bg-white/10"}`}>
                        {note?.endTime && <span className="absolute inset-x-1 bottom-0 h-1 rounded-full bg-cyan-100" />}
                      </button>;
                    })}
                  </div>;
                })}
                {map.notes.filter((note) => note.time < visibleStart || note.time >= visibleEnd).length > 0 && <div className="sticky bottom-0 border-t bg-card p-2 text-center text-xs text-muted-foreground">Des notes sont hors de la fenêtre affichée. Utilise les flèches de mesures.</div>}
              </div>
            </div>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">Clique une cellule pour ajouter/supprimer un tap. Pour un hold, choisis le début puis la fin dans la même colonne. {Math.round(beatLength)} ms par temps.</p>
        </section>
      </div>
    </div>
  );
}
