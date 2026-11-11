
interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface Env {
  OPENROUTER_API_KEY: string;
}

const SYSTEM_PROMPT = `
Sen BÜNYO AI isimli kişisel yapay zekâ asistanısın.

Kullanıcıyla daima Türkçe konuş.
Samimi, doğal, açık ve faydalı cevaplar ver.
Bilmediğin bilgileri uydurma.
Kodlama sorularında uygulanabilir örnekler sun.
Android, Kotlin, Java, web geliştirme ve tasarım
konularında yardımcı ol.
Kullanıcının isteklerini dikkatle takip et.
Kendini BÜNYO AI olarak tanıt.
`;

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type"
    };

    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: corsHeaders
      });
    }

    const url = new URL(request.url);

    if (url.pathname === "/" && request.method === "GET") {
      return Response.json({
        name: "BÜNYO AI",
        status: "online",
        version: "1.1"
      }, { headers: corsHeaders });
    }

    if (url.pathname !== "/api/chat" || request.method !== "POST") {
      return Response.json(
        { error: "Geçersiz istek." },
        { status: 404, headers: corsHeaders }
      );
    }

    try {
      if (!env.OPENROUTER_API_KEY) {
        return Response.json(
          { error: "OpenRouter API anahtarı tanımlanmamış." },
          { status: 500, headers: corsHeaders }
        );
      }

      const body = await request.json() as {
        messages?: ChatMessage[];
      };

      if (!Array.isArray(body.messages) || body.messages.length === 0) {
        return Response.json(
          { error: "Mesaj bulunamadı." },
          { status: 400, headers: corsHeaders }
        );
      }

      const messages = body.messages
        .filter(m =>
          (m.role === "user" || m.role === "assistant") &&
          typeof m.content === "string" &&
          m.content.trim().length > 0
        )
        .slice(-12)
        .map(m => ({
          role: m.role,
          content: m.content.slice(0, 4000)
        }));

      if (
        messages.length === 0 ||
        messages[messages.length - 1].role !== "user"
      ) {
        return Response.json(
          { error: "Geçerli kullanıcı mesajı gerekli." },
          { status: 400, headers: corsHeaders }
        );
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
            model: "google/gemini-2.5-pro",
            max_tokens: 3000,
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

      const result = await response.json() as {
        choices?: Array<{
          message?: {
            content?: string;
          };
        }>;
        error?: {
          message?: string;
        };
      };

      if (!response.ok) {
        console.error("OpenRouter error:", result.error);

        return Response.json(
          {
            error: result.error?.message ||
              "OpenRouter bağlantı hatası."
          },
          {
            status: response.status,
            headers: corsHeaders
          }
        );
      }

      const reply = result.choices?.[0]?.message?.content;

      if (!reply) {
        return Response.json(
          { error: "AI boş yanıt döndürdü." },
          { status: 502, headers: corsHeaders }
        );
      }

      return Response.json(
        { reply },
        { headers: corsHeaders }
      );

    } catch (error) {
      console.error("BÜNYO AI error:", error);

      return Response.json(
        {
          error: "Sunucu hatası. Lütfen tekrar dene."
        },
        { status: 500, headers: corsHeaders }
      );
    }
  }
};
