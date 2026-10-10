// Windows ses cihazlarını listeleme ve varsayılan cihazı ayarlama (Core Audio).
// kurulum.ps1 tarafından Add-Type ile derlenir. Sadece o anda oturum açmış kullanıcının ayarını değiştirir.
using System;
using System.Collections.Generic;
using System.Runtime.InteropServices;

namespace WexonGrowth
{
    [ComImport, Guid("BCDE0395-E52F-467C-8E3D-C4579291692E")]
    class MMDeviceEnumeratorCom { }

    [Guid("A95664D2-9614-4F35-A746-DE8DB63617E6"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    interface IMMDeviceEnumerator
    {
        [PreserveSig] int EnumAudioEndpoints(int dataFlow, int stateMask, out IMMDeviceCollection devices);
        [PreserveSig] int GetDefaultAudioEndpoint(int dataFlow, int role, out IMMDevice endpoint);
        [PreserveSig] int GetDevice([MarshalAs(UnmanagedType.LPWStr)] string id, out IMMDevice device);
        [PreserveSig] int RegisterEndpointNotificationCallback(IntPtr client);
        [PreserveSig] int UnregisterEndpointNotificationCallback(IntPtr client);
    }

    [Guid("0BD7A1BE-7A1A-44DB-8397-CC5392387B5E"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    interface IMMDeviceCollection
    {
        [PreserveSig] int GetCount(out int count);
        [PreserveSig] int Item(int index, out IMMDevice device);
    }

    [Guid("D666063F-1587-4E43-81F1-B948E807363F"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    interface IMMDevice
    {
        [PreserveSig] int Activate(ref Guid iid, int clsCtx, IntPtr activationParams, [MarshalAs(UnmanagedType.IUnknown)] out object iface);
        [PreserveSig] int OpenPropertyStore(int access, out IPropertyStore props);
        [PreserveSig] int GetId([MarshalAs(UnmanagedType.LPWStr)] out string id);
        [PreserveSig] int GetState(out int state);
    }

    [Guid("886d8eeb-8cf2-4446-8d02-cdba1dbdcf99"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    interface IPropertyStore
    {
        [PreserveSig] int GetCount(out int count);
        [PreserveSig] int GetAt(int prop, out PropertyKey key);
        [PreserveSig] int GetValue(ref PropertyKey key, out PropVariant value);
        [PreserveSig] int SetValue(ref PropertyKey key, ref PropVariant value);
        [PreserveSig] int Commit();
    }

    [StructLayout(LayoutKind.Sequential)]
    struct PropertyKey { public Guid fmtid; public int pid; }

    [StructLayout(LayoutKind.Explicit)]
    struct PropVariant { [FieldOffset(0)] public short vt; [FieldOffset(8)] public IntPtr pointer; }

    // Windows'un kendi ses ayarları penceresinin kullandığı arayüz (belgelenmemiş ama Windows 7–11'de sabit).
    [ComImport, Guid("870af99c-171d-4f9e-af0d-e63df40c2bc9")]
    class PolicyConfigClient { }

    [Guid("f8679f50-850a-41cf-9c72-430f290290c8"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    interface IPolicyConfig
    {
        // Sadece SetDefaultEndpoint kullanılır; öncekiler sanal tablo sırası için yer tutucudur.
        [PreserveSig] int GetMixFormat();
        [PreserveSig] int GetDeviceFormat();
        [PreserveSig] int ResetDeviceFormat();
        [PreserveSig] int SetDeviceFormat();
        [PreserveSig] int GetProcessingPeriod();
        [PreserveSig] int SetProcessingPeriod();
        [PreserveSig] int GetShareMode();
        [PreserveSig] int SetShareMode();
        [PreserveSig] int GetPropertyValue();
        [PreserveSig] int SetPropertyValue();
        [PreserveSig] int SetDefaultEndpoint([MarshalAs(UnmanagedType.LPWStr)] string deviceId, int role);
        [PreserveSig] int SetEndpointVisibility();
    }

    public class SesCihazi
    {
        public string Id;
        public string Ad;
        public bool Cikis; // true: hoparlör/çıkış, false: mikrofon/giriş
        public override string ToString() { return (Cikis ? "[Çıkış] " : "[Giriş] ") + Ad; }
    }

    public static class Ses
    {
        static readonly PropertyKey FriendlyName = new PropertyKey { fmtid = new Guid("a45c254e-df1c-4efd-8020-67d146a850e0"), pid = 14 };

        public static List<SesCihazi> Listele()
        {
            var list = new List<SesCihazi>();
            var en = (IMMDeviceEnumerator)new MMDeviceEnumeratorCom();
            foreach (var flow in new[] { 0, 1 }) // 0 = çıkış (render), 1 = giriş (capture)
            {
                IMMDeviceCollection col;
                if (en.EnumAudioEndpoints(flow, 1 /* DEVICE_STATE_ACTIVE */, out col) != 0) continue;
                int n; col.GetCount(out n);
                for (int i = 0; i < n; i++)
                {
                    IMMDevice dev; col.Item(i, out dev);
                    string id; dev.GetId(out id);
                    IPropertyStore ps; dev.OpenPropertyStore(0, out ps);
                    var key = FriendlyName; PropVariant pv;
                    string ad = id;
                    if (ps.GetValue(ref key, out pv) == 0 && pv.vt == 31 /* VT_LPWSTR */) ad = Marshal.PtrToStringUni(pv.pointer);
                    list.Add(new SesCihazi { Id = id, Ad = ad, Cikis = flow == 0 });
                }
            }
            return list;
        }

        public static string Varsayilan(bool cikis, int rol)
        {
            var en = (IMMDeviceEnumerator)new MMDeviceEnumeratorCom();
            IMMDevice dev;
            if (en.GetDefaultAudioEndpoint(cikis ? 0 : 1, rol, out dev) != 0) return null;
            string id; dev.GetId(out id);
            return id;
        }

        /// <summary>Cihazı üç rolde de (konsol, multimedya, iletişim) varsayılan yapar.</summary>
        public static void VarsayilanYap(string deviceId)
        {
            var pc = (IPolicyConfig)new PolicyConfigClient();
            for (int rol = 0; rol < 3; rol++)
            {
                int hr = pc.SetDefaultEndpoint(deviceId, rol);
                if (hr != 0) Marshal.ThrowExceptionForHR(hr);
            }
        }
    }
}
