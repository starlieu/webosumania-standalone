using System.Collections.ObjectModel;

namespace WebOsuMania.Native;

public partial class EditorPage : ContentPage
{
    private readonly ObservableCollection<string> _notes = new();

    public EditorPage()
    {
        InitializeComponent();
        NoteList.ItemsSource = _notes;
    }

    private void AddNoteClicked(object? sender, EventArgs e)
    {
        if (string.IsNullOrWhiteSpace(TitleEntry.Text))
        {
            _ = DisplayAlert("Map editor", "Give the map a title first.", "OK");
            return;
        }

        var timeText = TimeEntry.Text?.Trim();
        if (!int.TryParse(timeText, out var timeMs))
        {
            _ = DisplayAlert("Map editor", "Enter a valid time in milliseconds.", "OK");
            return;
        }

        _notes.Add($"{TitleEntry.Text} · {timeMs} ms");
        TimeEntry.Text = string.Empty;
    }

    private async void ExportClicked(object? sender, EventArgs e)
    {
        if (_notes.Count == 0)
        {
            await DisplayAlert("Map editor", "Add at least one note before exporting.", "OK");
            return;
        }

        var mapTitle = string.IsNullOrWhiteSpace(TitleEntry.Text) ? "NewMap" : TitleEntry.Text.Trim();
        var exportText = string.Join(Environment.NewLine, _notes);
        await DisplayAlert("Map editor", $"{mapTitle} exported locally with {_notes.Count} notes.\n\n{exportText}", "OK");
    }
}
