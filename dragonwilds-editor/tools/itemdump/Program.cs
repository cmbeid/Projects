// Dumps every ITEM_* and RECIPE_* asset in the game's paks as
// { items: [{ id, name, internalName, path, class }], recipes: [{ id, name, internalName, path, class, items }] }.
//
// The .usmap that ships with PEAKEGames/DWCharacterEditor predates 1.0, so
// property parsing stops a few fields in, before PersistenceID. Rather than
// depend on a fresh mapping, this scans each asset's raw bytes:
//   - PersistenceID is an FString holding the 22-char URL-safe base64 ID.
//   - Name is an FText pointing into a string table (history type 0x0B:
//     table FName, then key FString). String tables load without mappings.
//
// usage: itemdump <Paks dir> <.usmap> <out.json> [native dll dir]
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
using CUE4Parse.Compression;
using CUE4Parse.FileProvider;
using CUE4Parse.MappingsProvider.Usmap;
using CUE4Parse.UE4.Assets.Exports.Internationalization;
using CUE4Parse.UE4.Versions;

var paks = args[0];
var usmap = args[1];
var outJson = args[2];
var nativeDir = args.Length > 3 ? args[3] : Path.Combine(AppContext.BaseDirectory, "native");
Directory.CreateDirectory(nativeDir);

// Oodle and zlib-ng decompressors, fetched on first run.
var oodlePath = Path.Combine(nativeDir, OodleHelper.OodleFileName);
if (!File.Exists(oodlePath)) OodleHelper.DownloadOodleDll(ref oodlePath);
OodleHelper.Initialize(oodlePath);
var zlibPath = Path.Combine(nativeDir, ZlibHelper.DllName);
if (!File.Exists(zlibPath)) ZlibHelper.DownloadDll(zlibPath, ZlibHelper.DOWNLOAD_URL);
ZlibHelper.Initialize(zlibPath);

// Unencrypted; mounts without an AES key.
var provider = new DefaultFileProvider(paks, SearchOption.TopDirectoryOnly,
    new VersionContainer(EGame.GAME_UE5_6), StringComparer.OrdinalIgnoreCase);
provider.MappingsContainer = new FileUsmapTypeMappingsProvider(usmap);
provider.Initialize();
provider.Mount();
Console.WriteLine($"Mounted {provider.Files.Count} files");

static bool IsAsset(string p, string prefix) =>
    p.EndsWith(".uasset", StringComparison.OrdinalIgnoreCase) &&
    Path.GetFileName(p).StartsWith(prefix, StringComparison.OrdinalIgnoreCase);

// Table object name ("ST_ItemNames") -> key -> English text.
var tables = new Dictionary<string, Dictionary<string, string>>(StringComparer.OrdinalIgnoreCase);
foreach (var p in provider.Files.Keys.Where(p => IsAsset(p, "ST_")))
    foreach (var lazy in provider.LoadPackage(p).ExportsLazy)
        if (lazy.Value is UStringTable st)
            tables[st.Name] = st.StringTable.KeysToEntries.ToDictionary(kv => kv.Key.ToString(), kv => kv.Value.ToString());
Console.WriteLine($"String tables: {tables.Count}");

// Tables that hold descriptions and tooltips rather than item names.
var notNames = new HashSet<string>(StringComparer.OrdinalIgnoreCase) { "ST_ItemDescriptions", "ST_ItemBuffs", "ST_ItemInfo" };
var idRx = new Regex("^[A-Za-z0-9_-]{22}$");
// Internal names ("armour_body_apprentice") can also be 22 chars; IDs are never all lowercase.
var internalRx = new Regex("^[a-z0-9_]+$");
var itemRefRx = new Regex("/(ITEM_[A-Za-z0-9_]+)");

static string? ReadFString(byte[] d, int i, out int next)
{
    next = i;
    if (i + 4 > d.Length) return null;
    int len = BitConverter.ToInt32(d, i);
    if (len < 2 || len > 300 || i + 4 + len > d.Length || d[i + 4 + len - 1] != 0) return null;
    for (int k = i + 4; k < i + 4 + len - 1; k++)
        if (d[k] < 0x20 || d[k] > 0x7e) return null;
    next = i + 4 + len;
    return Encoding.ASCII.GetString(d, i + 4, len - 1);
}

// Reads an asset's ID, internal name, display name and the ITEM_ assets it
// references (a recipe references the item it makes, and sometimes others).
(string? id, string? internalName, string? name, string? nameKey, string? cls, List<string> itemRefs) Scan(string path)
{
    var pkg = provider.LoadPackage(path);
    var names = pkg.NameMap.Select(n => n.Name ?? "").ToArray();
    var cls = pkg.ExportsLazy.FirstOrDefault()?.Value.ExportType;
    var d = provider.SaveAsset(path);

    string? id = null, internalName = null;
    var texts = new List<(string table, string key, string text)>();
    for (int i = 0; i + 4 < d.Length; i++)
    {
        if (d[i] == 0x0B && i + 9 < d.Length)
        {
            int ni = BitConverter.ToInt32(d, i + 1), num = BitConverter.ToInt32(d, i + 5);
            if (ni >= 0 && ni < names.Length && num == 0 && ReadFString(d, i + 9, out var after) is string key)
            {
                var table = names[ni].Split('.').Last();
                if (!notNames.Contains(table) && !key.Contains("Description", StringComparison.OrdinalIgnoreCase) &&
                    tables.TryGetValue(table, out var t) && t.TryGetValue(key, out var text) && text.Trim() != "")
                    texts.Add((table, key, text.Trim()));
                i = after - 1;
                continue;
            }
        }
        if (ReadFString(d, i, out var next) is string s)
        {
            if (idRx.IsMatch(s) && !internalRx.IsMatch(s)) id ??= s;
            else if (internalRx.IsMatch(s)) internalName = s;
            i = next - 1;
        }
    }
    // ST_ItemNames is the item-name table; other tables (ST_Localization and
    // so on) also hold UI strings such as a container's "Contents: ..." line.
    var pick = texts.Cast<(string table, string key, string text)?>()
        .FirstOrDefault(x => x!.Value.table.Equals("ST_ItemNames", StringComparison.OrdinalIgnoreCase))
        ?? texts.Cast<(string table, string key, string text)?>().FirstOrDefault();
    // Imported package paths sit in the header as plain ASCII.
    var itemRefs = itemRefRx.Matches(Encoding.Latin1.GetString(d)).Select(m => m.Groups[1].Value).Distinct().ToList();
    return (id, internalName, pick?.text, pick is { } pk ? pk.table + ":" + pk.key : null, cls, itemRefs);
}

var items = new List<object>();
foreach (var path in provider.Files.Keys.Where(p => IsAsset(p, "ITEM_")).OrderBy(p => p, StringComparer.Ordinal))
{
    var a = Scan(path);
    if (a.id == null) continue; // mesh-data and other non-item assets
    items.Add(new { a.id, a.name, a.nameKey, a.internalName, path, @class = a.cls });
}
Console.WriteLine($"Items: {items.Count}");

// RecipesUnlocked in the save holds these IDs.
var recipes = new List<object>();
foreach (var path in provider.Files.Keys.Where(p => IsAsset(p, "RECIPE_")).OrderBy(p => p, StringComparer.Ordinal))
{
    var a = Scan(path);
    if (a.id == null) continue;
    recipes.Add(new { a.id, a.name, a.internalName, path, @class = a.cls, items = a.itemRefs });
}
Console.WriteLine($"Recipes: {recipes.Count}");

File.WriteAllText(outJson, JsonSerializer.Serialize(new { items, recipes }, new JsonSerializerOptions { WriteIndented = true }) + "\n");
