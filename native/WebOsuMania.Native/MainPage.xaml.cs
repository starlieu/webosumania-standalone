using System.Collections.ObjectModel;
using WebOsuMania.Native.Models;
using WebOsuMania.Native.Services;

namespace WebOsuMania.Native;

public partial class MainPage : ContentPage
{
    private readonly ObservableCollection<BeatmapEntry> _beatmaps = new();

    public MainPage()
    {
        InitializeComponent();
        BeatmapList.ItemsSource = _beatmaps;
    }

    protected override void OnAppearing()
    {
        base.OnAppearing();
        _ = RefreshAsync();
    }

    private async Task RefreshAsync()
    {
        StatusLabel.Text = "Scanning local files...";
        _beatmaps.Clear();

        var beatmaps = OfflineBeatmapLibrary.FindLocalBeatmaps();
        foreach (var beatmap in beatmaps)
        {
            _beatmaps.Add(beatmap);
        }

        StatusLabel.Text = beatmaps.Count == 0
            ? "No local beatmaps found. Put .osz or .osu files in a local folder to play offline."
            : $"{beatmaps.Count} beatmaps ready for offline play";
    }

    private async void RefreshButton_Clicked(object? sender, EventArgs e)
    {
        await RefreshAsync();
    }

    private async void PlayButton_Clicked(object? sender, EventArgs e)
    {
        var selected = BeatmapList.SelectedItem as BeatmapEntry;
        if (selected is null)
        {
            await DisplayAlert("Offline play", "Select a beatmap first.", "OK");
            return;
        }

        await DisplayAlert("Offline play", $"Launching local map: {selected.Title}\n{selected.Path}", "OK");
    }

    private void OpenFolderButton_Clicked(object? sender, EventArgs e)
    {
        OfflineBeatmapLibrary.OpenFolder(Environment.GetFolderPath(Environment.SpecialFolder.MyDocuments));
    }
}
