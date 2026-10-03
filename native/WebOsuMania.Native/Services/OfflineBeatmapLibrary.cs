using System.Diagnostics;
using WebOsuMania.Native.Models;

namespace WebOsuMania.Native.Services;

public static class OfflineBeatmapLibrary
{
    public static IReadOnlyList<BeatmapEntry> FindLocalBeatmaps()
    {
        var results = new List<BeatmapEntry>();
        var seen = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

        foreach (var root in GetSearchRoots())
        {
            if (!Directory.Exists(root))
            {
                continue;
            }

            foreach (var file in Directory.EnumerateFiles(root, "*.*", SearchOption.AllDirectories))
            {
                var extension = Path.GetExtension(file);
                if (!string.Equals(extension, ".osz", StringComparison.OrdinalIgnoreCase) &&
                    !string.Equals(extension, ".osu", StringComparison.OrdinalIgnoreCase))
                {
                    continue;
                }

                if (!seen.Add(file))
                {
                    continue;
                }

                var title = Path.GetFileNameWithoutExtension(file);
                var source = DetectSource(file);
                results.Add(new BeatmapEntry
                {
                    Title = title,
                    Path = file,
                    Source = source,
                });
            }
        }

        return results
            .OrderBy(entry => entry.Title, StringComparer.OrdinalIgnoreCase)
            .ToList();
    }

    public static void OpenFolder(string path)
    {
        if (string.IsNullOrWhiteSpace(path) || !Directory.Exists(path))
        {
            return;
        }

        var psi = new ProcessStartInfo
        {
            FileName = "explorer.exe",
            Arguments = $"/select,\"{path}\"",
            UseShellExecute = true,
        };

        Process.Start(psi);
    }

    private static IEnumerable<string> GetSearchRoots()
    {
        var roots = new List<string>
        {
            Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "WebOsuMania"),
            Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.MyDocuments), "WebOsuMania"),
            Environment.GetFolderPath(Environment.SpecialFolder.MyMusic),
            Environment.GetFolderPath(Environment.SpecialFolder.DesktopDirectory),
        };

        if (!string.IsNullOrWhiteSpace(Environment.GetEnvironmentVariable("USERPROFILE")))
        {
            roots.Add(Path.Combine(Environment.GetEnvironmentVariable("USERPROFILE")!, "Downloads"));
        }

        return roots.Distinct(StringComparer.OrdinalIgnoreCase);
    }

    private static string DetectSource(string path)
    {
        var lower = path.ToLowerInvariant();
        if (lower.Contains("downloads")) return "Downloads";
        if (lower.Contains("documents")) return "Documents";
        if (lower.Contains("music")) return "Music";
        if (lower.Contains("webosumania")) return "Local library";
        return "Local file";
    }
}
