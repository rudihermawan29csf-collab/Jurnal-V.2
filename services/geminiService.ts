
import { GoogleGenAI } from "@google/genai";
import { TeacherData } from "../types";

// Convert the data to a CSV-like string for the LLM
const getDataContext = (data: TeacherData[]) => {
  const header = "No,Name,Subject,TotalHours,AdditionalTask";
  const rows = data.map(t => 
    `${t.no},${t.name},${t.subject},${t.totalHours},${t.additionalTask ?? '-'}`
  ).join("\n");
  return `Dataset:\n${header}\n${rows}`;
};

export const askGemini = async (question: string, data?: TeacherData[]): Promise<string> => {
  // Fallback if data not provided (though App should provide it)
  if (!data) return "Data tidak tersedia untuk analisis.";

  try {
    // FIX: Menggunakan process.env.API_KEY secara langsung dalam inisialisasi client
    if (!process.env.API_KEY) {
      console.warn("API_KEY is missing");
      return "Kunci API tidak ditemukan.";
    }

    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const dataContext = getDataContext(data);
    
    const prompt = `
      You are an intelligent assistant analyzing a school's teacher task distribution table.
      
      ${dataContext}
      
      User Question: "${question}"
      
      Answer concisely based strictly on the provided dataset. Use professional language (Indonesian).
      Format the output with Markdown if needed (bolding key figures).
    `;

    // FIX: Menggunakan model 'gemini-3-flash-preview' untuk tugas analisis data teks dasar
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
    });

    return response.text || "Maaf, saya tidak dapat menganalisis data saat ini.";
  } catch (error) {
    console.error("Gemini API Error:", error);
    return "Terjadi kesalahan saat menghubungi asisten AI.";
  }
};
