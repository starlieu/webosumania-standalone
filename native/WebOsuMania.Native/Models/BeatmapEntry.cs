namespace WebOsuMania.Native.Models;

public sealed class BeatmapEntry
{
    public required string Title { get; init; }
    public required string Path { get; init; }
    public required string Source { get; init; }
    public string Details => $"{Source} · {System.IO.Path.GetFileName(Path)}";
}
