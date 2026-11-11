interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface Env {
  OPENROUTER_API_KEY: string;
}

const SYSTEM_PROMPT = `
Sen BÜNYO AI isimli kişisel yapay zekâ asistanısın.
Kullanıcıyla Türkçe konuş.
Açık, doğru, samimi ve faydalı cevaplar ver.
Bilmediğin bilgileri uydurma.
Kodlama sorularında uygulanabilir örnekler sun.
Kendini BÜNYO AI olarak tanıt.
`;

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname !== "/api/chat" || request.method !== "POST") {
      return Response.json({
        name: "BÜNYO AI",
        status: "online",
        version: "1.0"
      });
    }

    try {
      if (!env.OPENROUTER_API_KEY) {
        throw new Error("OpenRouter API anahtarı tanımlanmamış.");
      }

      const body = await request.json() as {
        messages?: ChatMessage[];
      };

      if (!Array.isArray(body.messages) || body.messages.length === 0) {
        return Response.json(
          { error: "Mesaj bulunamadı." },
          { status: 400 }
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
        !messages.length ||
        messages[messages.length - 1].role !== "user"
      ) {
        return Response.json(
          { error: "Geçerli kullanıcı mesajı gerekli." },
          { status: 400 }
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
            model: "google/gemini-2.5-pro",            messages: [
              { role: "system", content: SYSTEM_PROMPT },
              ...messages
            ]
          })
        }
      );

      const result = await response.json() as {
        choices?: Array<{
          message?: { content?: string };
        }>;
        error?: { message?: string };
      };

      if (!response.ok) {
        return Response.json(
          { error: result.error?.message || "OpenRouter bağlantı hatası." },
          { status: response.status }
        );
      }

      const reply = result.choices?.[0]?.message?.content;

      if (!reply) {
        throw new Error("AI boş yanıt döndürdü.");
      }

      return Response.json({ reply });

    } catch (error) {
      console.error("BÜNYO AI:", error);

      return Response.json(
        { error: "Yapay zekâ şu anda cevap veremedi." },
        { status: 500 }
      );
    }
  }
};
