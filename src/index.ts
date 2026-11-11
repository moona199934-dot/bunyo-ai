
interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface Env {
  OPENROUTER_API_KEY: string;
  AI: {
    run(model: string, input: any): Promise<any>;
  };
}

const SYSTEM_PROMPT = `
Sen BÜNYO AI isimli kişisel yapay zekâ asistanısın.

Daima Türkçe konuş.
Samimi, doğal, hızlı ve faydalı cevaplar ver.
Bilmediğin bilgileri uydurma.
Kodlama sorularında uygulanabilir çözümler sun.
Android, Kotlin, Java, web geliştirme ve tasarım konularında uzmansın.
Kullanıcının önceki mesajlarını dikkate al.
Kendini BÜNYO AI olarak tanıt.
Gereksiz uzun cevaplar verme.
Kullanıcı ayrıntı isterse ayrıntılı anlat.
`;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function json(data: unknown, status = 200): Response {
  return Response.json(data, {
    status,
    headers: CORS,
  });
}

function base64(bytes: Uint8Array): string {
  let binary = "";
  const chunkSize = 8192;

  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(
      ...bytes.subarray(i, i + chunkSize)
    );
  }

  return btoa(binary);
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: CORS });
    }

    const url = new URL(request.url);

    if (request.method === "GET" && url.pathname === "/") {
      return json({
        name: "BÜNYO AI",
        status: "online",
        version: "2.0",
        features: [
          "chat",
          "image-generation",
          "logo-generation",
          "banner-generation",
          "image-analysis"
        ]
      });
    }

    if (request.method !== "POST") {
      return json({ error: "POST isteği gerekli." }, 405);
    }

    try {
      const body = await request.json() as any;

      // HIZLI SOHBET
      if (url.pathname === "/api/chat") {
        if (!env.OPENROUTER_API_KEY) {
          return json({
            error: "OpenRouter API anahtarı bulunamadı."
          }, 500);
        }

        if (
          !Array.isArray(body.messages) ||
          body.messages.length === 0
        ) {
          return json({
            error: "Mesaj bulunamadı."
          }, 400);
        }

        const messages: ChatMessage[] = body.messages
          .filter((m: any) =>
            (m.role === "user" || m.role === "assistant") &&
            typeof m.content === "string" &&
            m.content.trim().length > 0
          )
          .slice(-10)
          .map((m: any) => ({
            role: m.role,
            content: m.content.slice(0, 3000)
          }));

        if (
          messages.length === 0 ||
          messages[messages.length - 1].role !== "user"
        ) {
          return json({
            error: "Geçerli kullanıcı mesajı gerekli."
          }, 400);
        }

        const response = await fetch(
          "https://openrouter.ai/api/v1/chat/completions",
          {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${env.OPENROUTER_API_KEY}`,
              "Content-Type": "application/json",
              "HTTP-Referer": "https://bunyo-ai.pages.dev",
              "X-Title": "BÜNYO AI"
            },
            body: JSON.stringify({
              model: "google/gemini-2.0-flash-001",
              temperature: 0.7,
              max_tokens: 1800,
              messages: [
                {
                  role: "system",
                  content: SYSTEM_PROMPT
                },
                ...messages
              ]
            })
          }
        );

        const result: any = await response.json();

        if (!response.ok) {
          return json({
            error: result.error?.message ||
              "Yapay zekâ bağlantı hatası."
          }, response.status);
        }

        const reply =
          result.choices?.[0]?.message?.content;

        if (!reply) {
          return json({
            error: "Yapay zekâ boş yanıt verdi."
          }, 502);
        }

        return json({ reply });
      }

      // GÖRSEL, LOGO VE BANNER ÜRETİMİ
      if (url.pathname === "/api/image") {
        if (typeof body.prompt !== "string" ||
            !body.prompt.trim()) {
          return json({
            error: "Görsel açıklaması gerekli."
          }, 400);
        }

        const type = ["image", "logo", "banner"].includes(body.type)
          ? body.type
          : "image";

        let prompt = body.prompt.trim().slice(0, 1500);

        if (type === "logo") {
          prompt =
            "Create a professional, clean, original brand logo. " +
            "Strong visual identity, balanced composition, " +
            "high quality graphic design. " + prompt;
        }

        if (type === "banner") {
          prompt =
            "Create a professional wide promotional banner, " +
            "beautiful composition, high quality graphic design. " +
            prompt;
        }

        const result: any = await env.AI.run(
          "@cf/black-forest-labs/flux-1-schnell",
          {
            prompt,
            steps: 4
          }
        );

        let imageData: string;

        if (typeof result === "string") {
          imageData = result;
        } else if (result?.image instanceof Uint8Array) {
          imageData = base64(result.image);
        } else if (result?.image) {
          imageData = String(result.image);
        } else {
          throw new Error("Görsel modeli boş sonuç döndürdü.");
        }

        return json({
          success: true,
          type,
          mimeType: "image/jpeg",
          imageBase64: imageData
        });
      }

      // YÜKLENEN GÖRSELİ İNCELEME
      if (url.pathname === "/api/vision") {
        if (
          typeof body.imageBase64 !== "string" ||
          !body.imageBase64.trim()
        ) {
          return json({
            error: "İncelenecek görsel gerekli."
          }, 400);
        }

        const mimeType = [
          "image/jpeg",
          "image/png",
          "image/webp"
        ].includes(body.mimeType)
          ? body.mimeType
          : "image/jpeg";

        const imageUrl =
          `data:${mimeType};base64,${body.imageBase64}`;

        const result: any = await env.AI.run(
          "@cf/meta/llama-3.2-11b-vision-instruct",
          {
            messages: [
              {
                role: "user",
                content: [
                  {
                    type: "text",
                    text: (
                      typeof body.prompt === "string" &&
                      body.prompt.trim()
                    )
                      ? body.prompt.slice(0, 1500)
                      : "Bu görseli Türkçe incele. İçeriğini, " +
                        "nesnelerini, yazılarını ve önemli ayrıntılarını açıkla."
                  },
                  {
                    type: "image_url",
                    image_url: {
                      url: imageUrl
                    }
                  }
                ]
              }
            ]
          }
        );

        const analysis =
          result?.description ||
          result?.response ||
          result?.choices?.[0]?.message?.content;

        if (!analysis) {
          throw new Error("Görsel analizi boş sonuç döndürdü.");
        }

        return json({
          success: true,
          analysis
        });
      }

      return json({
        error: "Bilinmeyen API adresi."
      }, 404);

    } catch (error) {
      console.error("BÜNYO AI ERROR:", error);

      return json({
        error: error instanceof Error
          ? error.message
          : "Sunucu hatası. Tekrar dene."
      }, 500);
    }
  }
};
