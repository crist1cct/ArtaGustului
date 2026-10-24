# Arta Gustului Media - helper Windows (audio, volum, taste media, receptor Bluetooth)
# Ruleaza permanent; primeste comenzi JSON pe stdin (o linie) si raspunde JSON pe stdout.

$ErrorActionPreference = 'Stop'
[Console]::InputEncoding = [System.Text.Encoding]::UTF8
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

Add-Type -TypeDefinition @'
using System;
using System.Collections.Generic;
using System.Runtime.InteropServices;

namespace AG {
  [ComImport, Guid("BCDE0395-E52F-467C-8E3D-C4579291692E")] class MMDeviceEnumeratorCo {}
  [ComImport, Guid("870af99c-171d-4f9e-af0d-e63df40c2bc9")] class PolicyConfigCo {}

  [Guid("A95664D2-9614-4F35-A746-DE8DB63617E6"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
  interface IMMDeviceEnumerator {
    int EnumAudioEndpoints(int dataFlow, int stateMask, out IMMDeviceCollection devices);
    int GetDefaultAudioEndpoint(int dataFlow, int role, out IMMDevice endpoint);
    int GetDevice([MarshalAs(UnmanagedType.LPWStr)] string id, out IMMDevice device);
  }
  [Guid("0BD7A1BE-7A1A-44DB-8397-CC5392387B5E"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
  interface IMMDeviceCollection {
    int GetCount(out int count);
    int Item(int index, out IMMDevice device);
  }
  [Guid("D666063F-1587-4E43-81F1-B948E807363F"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
  interface IMMDevice {
    int Activate(ref Guid iid, int clsCtx, IntPtr activationParams, [MarshalAs(UnmanagedType.IUnknown)] out object iface);
    int OpenPropertyStore(int access, out IPropertyStore store);
    int GetId([MarshalAs(UnmanagedType.LPWStr)] out string id);
    int GetState(out int state);
  }
  [Guid("886d8eeb-8cf2-4446-8d02-cdba1dbdcf99"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
  interface IPropertyStore {
    int GetCount(out int count);
    int GetAt(int prop, out PROPERTYKEY key);
    int GetValue(ref PROPERTYKEY key, out PROPVARIANT value);
  }
  [StructLayout(LayoutKind.Sequential)] struct PROPERTYKEY { public Guid fmtid; public int pid; }
  [StructLayout(LayoutKind.Explicit)] struct PROPVARIANT {
    [FieldOffset(0)] public short vt;
    [FieldOffset(8)] public IntPtr p;
    [FieldOffset(16)] public IntPtr p2;
  }
  [Guid("5CDF2C82-841E-4546-9722-0CF74078229A"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
  interface IAudioEndpointVolume {
    int RegisterControlChangeNotify(IntPtr p);
    int UnregisterControlChangeNotify(IntPtr p);
    int GetChannelCount(out uint c);
    int SetMasterVolumeLevel(float db, ref Guid ctx);
    int SetMasterVolumeLevelScalar(float lvl, ref Guid ctx);
    int GetMasterVolumeLevel(out float db);
    int GetMasterVolumeLevelScalar(out float lvl);
    int SetChannelVolumeLevel(uint ch, float db, ref Guid ctx);
    int SetChannelVolumeLevelScalar(uint ch, float lvl, ref Guid ctx);
    int GetChannelVolumeLevel(uint ch, out float db);
    int GetChannelVolumeLevelScalar(uint ch, out float lvl);
    int SetMute([MarshalAs(UnmanagedType.Bool)] bool mute, ref Guid ctx);
    int GetMute([MarshalAs(UnmanagedType.Bool)] out bool mute);
  }
  [Guid("F8679F50-850A-41CF-9C72-430F290290C8"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
  interface IPolicyConfig {
    int GetMixFormat([MarshalAs(UnmanagedType.LPWStr)] string id, IntPtr p);
    int GetDeviceFormat([MarshalAs(UnmanagedType.LPWStr)] string id, int b, IntPtr p);
    int ResetDeviceFormat([MarshalAs(UnmanagedType.LPWStr)] string id);
    int SetDeviceFormat([MarshalAs(UnmanagedType.LPWStr)] string id, IntPtr a, IntPtr b);
    int GetProcessingPeriod([MarshalAs(UnmanagedType.LPWStr)] string id, int b, IntPtr a, IntPtr c);
    int SetProcessingPeriod([MarshalAs(UnmanagedType.LPWStr)] string id, IntPtr a);
    int GetShareMode([MarshalAs(UnmanagedType.LPWStr)] string id, IntPtr a);
    int SetShareMode([MarshalAs(UnmanagedType.LPWStr)] string id, IntPtr a);
    int GetPropertyValue([MarshalAs(UnmanagedType.LPWStr)] string id, IntPtr key, IntPtr v);
    int SetPropertyValue([MarshalAs(UnmanagedType.LPWStr)] string id, IntPtr key, IntPtr v);
    int SetDefaultEndpoint([MarshalAs(UnmanagedType.LPWStr)] string id, int role);
    int SetEndpointVisibility([MarshalAs(UnmanagedType.LPWStr)] string id, int vis);
  }

  public class AudioDevice { public string Id; public string Name; public bool IsDefault; }

  public static class Audio {
    [DllImport("ole32.dll")] static extern int PropVariantClear(ref PROPVARIANT pv);
    [DllImport("user32.dll")] static extern void keybd_event(byte vk, byte scan, uint flags, UIntPtr extra);

    static IMMDeviceEnumerator Enumerator() { return (IMMDeviceEnumerator)(new MMDeviceEnumeratorCo()); }

    static string FriendlyName(IMMDevice dev) {
      IPropertyStore store;
      dev.OpenPropertyStore(0, out store);
      PROPERTYKEY key = new PROPERTYKEY();
      key.fmtid = new Guid("a45c254e-df1c-4efd-8020-67d146a850e0");
      key.pid = 14;
      PROPVARIANT v;
      store.GetValue(ref key, out v);
      string name = v.vt == 31 ? Marshal.PtrToStringUni(v.p) : "Dispozitiv audio";
      PropVariantClear(ref v);
      return name;
    }

    static string DefaultId() {
      IMMDevice def;
      if (Enumerator().GetDefaultAudioEndpoint(0, 1, out def) != 0 || def == null) return null;
      string id; def.GetId(out id);
      return id;
    }

    public static List<AudioDevice> List() {
      List<AudioDevice> result = new List<AudioDevice>();
      IMMDeviceCollection col;
      Enumerator().EnumAudioEndpoints(0, 1, out col);
      int count; col.GetCount(out count);
      string defId = DefaultId();
      for (int i = 0; i < count; i++) {
        IMMDevice dev; col.Item(i, out dev);
        string id; dev.GetId(out id);
        AudioDevice d = new AudioDevice();
        d.Id = id; d.Name = FriendlyName(dev); d.IsDefault = (id == defId);
        result.Add(d);
      }
      return result;
    }

    public static void SetDefault(string id) {
      IPolicyConfig pc = (IPolicyConfig)(new PolicyConfigCo());
      for (int role = 0; role < 3; role++) Marshal.ThrowExceptionForHR(pc.SetDefaultEndpoint(id, role));
    }

    static IAudioEndpointVolume Volume() {
      IMMDevice def;
      Marshal.ThrowExceptionForHR(Enumerator().GetDefaultAudioEndpoint(0, 1, out def));
      Guid iid = typeof(IAudioEndpointVolume).GUID;
      object o;
      Marshal.ThrowExceptionForHR(def.Activate(ref iid, 23, IntPtr.Zero, out o));
      return (IAudioEndpointVolume)o;
    }

    public static int GetVolume() { float v; Volume().GetMasterVolumeLevelScalar(out v); return (int)Math.Round(v * 100); }
    public static void SetVolume(int level) {
      Guid g = Guid.Empty;
      Volume().SetMasterVolumeLevelScalar(Math.Max(0, Math.Min(100, level)) / 100f, ref g);
    }
    public static bool GetMute() { bool m; Volume().GetMute(out m); return m; }
    public static void SetMute(bool m) { Guid g = Guid.Empty; Volume().SetMute(m, ref g); }

    public static void Key(byte vk) {
      keybd_event(vk, 0, 1, UIntPtr.Zero);
      keybd_event(vk, 0, 3, UIntPtr.Zero);
    }
  }
}
'@

# ---------- WinRT (receptor Bluetooth: telefonul reda prin laptop) ----------
$script:btReady = $false
$script:btConnections = @{}
try {
  Add-Type -AssemblyName System.Runtime.WindowsRuntime
  $script:asTaskOp = ([System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object {
    $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1' })[0]
  $script:asTaskAction = ([System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object {
    $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncAction' })[0]
  [void][Windows.Media.Audio.AudioPlaybackConnection, Windows.Media.Audio, ContentType = WindowsRuntime]
  [void][Windows.Devices.Enumeration.DeviceInformation, Windows.Devices.Enumeration, ContentType = WindowsRuntime]
  $script:btReady = $true
} catch { $script:btError = $_.Exception.Message }

function Await-Op($op, [Type]$type) {
  $task = $script:asTaskOp.MakeGenericMethod($type).Invoke($null, @($op))
  [void]$task.Wait(15000)
  $task.Result
}
function Await-Action($action) {
  $task = $script:asTaskAction.Invoke($null, @($action))
  [void]$task.Wait(15000)
}

function Get-BtDevices {
  if (-not $script:btReady) { throw "Receptorul Bluetooth necesita Windows 10 versiunea 2004 sau mai noua. $script:btError" }
  $sel = [Windows.Media.Audio.AudioPlaybackConnection]::GetDeviceSelector()
  $devs = Await-Op ([Windows.Devices.Enumeration.DeviceInformation]::FindAllAsync($sel)) ([Windows.Devices.Enumeration.DeviceInformationCollection])
  $list = @()
  foreach ($d in $devs) {
    $state = 'disconnected'
    if ($script:btConnections.ContainsKey($d.Id)) { $state = $script:btConnections[$d.Id].State.ToString().ToLower() }
    $list += [pscustomobject]@{ id = $d.Id; name = $d.Name; state = $state }
  }
  ,$list
}

function Connect-Bt([string]$id) {
  if ($script:btConnections.ContainsKey($id)) { $script:btConnections[$id].Dispose(); $script:btConnections.Remove($id) }
  $conn = [Windows.Media.Audio.AudioPlaybackConnection]::TryCreateFromId($id)
  if ($null -eq $conn) { throw 'Telefonul nu poate fi folosit ca sursa audio.' }
  Await-Action ($conn.StartAsync())
  $res = Await-Op ($conn.OpenAsync()) ([Windows.Media.Audio.AudioPlaybackConnectionOpenResult])
  if ($res.Status.ToString() -ne 'Success') {
    $conn.Dispose()
    throw "Conectarea a esuat ($($res.Status)). Verifica Bluetooth pe telefon."
  }
  $script:btConnections[$id] = $conn
  'connected'
}

function Disconnect-Bt([string]$id) {
  if ($script:btConnections.ContainsKey($id)) { $script:btConnections[$id].Dispose(); $script:btConnections.Remove($id) }
  'disconnected'
}

function Send($obj) {
  [Console]::Out.WriteLine(($obj | ConvertTo-Json -Compress -Depth 5))
  [Console]::Out.Flush()
}

Send @{ id = 0; ok = $true; result = 'ready'; bluetooth = $script:btReady }

while ($true) {
  $line = [Console]::In.ReadLine()
  if ($null -eq $line) { break }
  if ($line.Trim() -eq '') { continue }
  $req = $null
  try {
    $req = $line | ConvertFrom-Json
    $a = $req.args
    $result = switch ($req.cmd) {
      'devices'      { ,@([AG.Audio]::List() | ForEach-Object { [pscustomobject]@{ id = $_.Id; name = $_.Name; isDefault = $_.IsDefault } }) }
      'setDefault'   { [AG.Audio]::SetDefault($a.id); 'ok' }
      'getVolume'    { @{ level = [AG.Audio]::GetVolume(); muted = [AG.Audio]::GetMute() } }
      'setVolume'    { [AG.Audio]::SetVolume([int]$a.level); @{ level = [AG.Audio]::GetVolume(); muted = [AG.Audio]::GetMute() } }
      'setMute'      { [AG.Audio]::SetMute([bool]$a.muted); @{ level = [AG.Audio]::GetVolume(); muted = [AG.Audio]::GetMute() } }
      'media'        {
        $vk = @{ playpause = 0xB3; next = 0xB0; prev = 0xB1; stop = 0xB2 }[$a.key]
        if ($vk) { [AG.Audio]::Key([byte]$vk) }
        'ok'
      }
      'btList'       { Get-BtDevices }
      'btConnect'    { Connect-Bt $a.id }
      'btDisconnect' { Disconnect-Bt $a.id }
      'ping'         { 'pong' }
      default        { throw "Comanda necunoscuta: $($req.cmd)" }
    }
    Send @{ id = $req.id; ok = $true; result = $result }
  } catch {
    $rid = 0
    if ($req -and $req.id) { $rid = $req.id }
    Send @{ id = $rid; ok = $false; error = $_.Exception.Message }
  }
}
