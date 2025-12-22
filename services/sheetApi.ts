
// Service to interact with Google Apps Script Web App
// Acts as a simple Key-Value store wrapper

// Ambil URL dari environment variable yang di-inject saat build
const SHEET_URL = process.env.VITE_SHEET_URL;

export const sheetApi = {
  // Check if cloud sync is enabled
  isConfigured: () => {
    const isValid = typeof SHEET_URL === 'string' && SHEET_URL.startsWith('https://script.google.com');
    if (!isValid) {
      console.warn("Sheet API: VITE_SHEET_URL belum dikonfigurasi dengan benar di Vercel.");
    }
    return isValid;
  },

  // Fetch all data from the sheet
  fetchAll: async () => {
    if (!sheetApi.isConfigured()) return null;
    
    try {
      console.log("Sheet API: Memulai pengambilan data dari Cloud...");
      const urlWithCacheBuster = `${SHEET_URL}?t=${Date.now()}`;
      
      // Gunakan fetch sederhana tanpa header kustom untuk menghindari CORS preflight yang ketat
      const response = await fetch(urlWithCacheBuster, {
        method: 'GET',
        mode: 'cors',
        cache: 'no-store'
      });
      
      if (!response.ok) {
        throw new Error(`Server returned status ${response.status}`);
      }

      const text = await response.text();
      
      // Jika Google mengalihkan ke halaman login/error, respon akan berupa HTML
      if (text.trim().startsWith('<!DOCTYPE html>') || text.trim().startsWith('<html')) {
        console.error("Sheet API Error: Google Apps Script meminta login. Pastikan setting 'Who has access' adalah 'Anyone'.");
        return null;
      }

      try {
        const data = JSON.parse(text);
        console.log("Sheet API: Data Cloud berhasil diterima.");
        return data;
      } catch (parseError) {
        console.error("Sheet API Error: Format JSON tidak valid.", text.substring(0, 100));
        return null;
      }
    } catch (error) {
      console.error("Sheet API Network Error:", error);
      return null;
    }
  },

  // Save specific key-value pair to the sheet
  save: async (key: string, value: any) => {
    if (!sheetApi.isConfigured()) return;
    
    try {
      // POST ke GAS seringkali membutuhkan mode no-cors karena mekanisme redirect internal Google
      await fetch(SHEET_URL!, {
        method: 'POST',
        mode: 'no-cors',
        headers: {
          'Content-Type': 'text/plain;charset=utf-8',
        },
        body: JSON.stringify({ key, value }),
      });
      
      console.log(`Sheet API: Data '${key}' dikirim ke Cloud.`);
      return { status: 'sent' };
    } catch (error) {
      console.error(`Sheet API Save Error (${key}):`, error);
    }
  }
};
