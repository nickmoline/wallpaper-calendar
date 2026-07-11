Add-Type -AssemblyName System.Windows.Forms;
$screens = [System.Windows.Forms.Screen]::AllScreens;
$results = @();
foreach ($s in $screens) {
    $results += @{
        index = $results.Count;
        width = $s.Bounds.Width;
        height = $s.Bounds.Height;
    }
}
$results | ConvertTo-Json -Compress
