export default async function handler(request, response) {
    // --- 新增 ---
    // 解决 Vercel fetch 时的 ERR_TLS_CERT_ALTNAME_INVALID
    // Vercel serverless 环境的 Node.js fetch (undici) 会验证证书
    // 将此环境变量设为 "0" 可在全局禁用此 serverless function 实例的 TLS 验证
    // 警告：这会禁用 SSL 证书验证，会带来安全风险。
    // 仅在您完全信任目标 API (HF_API_URL) 且无法解决证书问题时使用。
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
    // --- 结束新增 ---

    // 1. 仅允许 POST 请求
    if (request.method !== 'POST') {
        response.status(405).json({ detail: 'Method Not Allowed' });
        return;
    }

    // 2. 从 Vercel 环境变量中获取机密信息
    const HF_API_URL = process.env.HF_API_URL;
    const HF_API_TOKEN = process.env.HF_API_TOKEN;

    if (!HF_API_URL || !HF_API_TOKEN) {
        console.error("Vercel 环境变量 HF_API_URL 或 HF_API_TOKEN 未设置");
        response.status(500).json({ detail: "服务器代理配置错误" });
        return;
    }

    // --- 新增日志：打印目标 URL (但不打印 Token) ---
    console.log(`[Proxy] 正在转发 POST 请求至: ${HF_API_URL}`);

    try {
        // 3. 将前端的请求转发到 Hugging Face
        const hfResponse = await fetch(HF_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${HF_API_TOKEN}`
            },
            body: JSON.stringify(request.body),
        });

        // 4. 处理来自 Hugging Face 的响应
        if (!hfResponse.ok) {
            // --- 增强日志：如果 HF API 返回错误，记录状态码 ---
            const errorData = await hfResponse.json();
            console.error(`[Proxy] Hugging Face API 错误: 状态码 ${hfResponse.status}`, errorData);

            // 将 HF 的错误状态码和详情转发给前端
            response.status(hfResponse.status).json(errorData);
        } else {
            // 如果成功，将数据转发给前端
            console.log("[Proxy] 成功从 HF API 获取数据并返回给前端");
            const data = await hfResponse.json();
            response.status(200).json(data);
        }

    } catch (error) {
        // --- 增强日志：打印完整的错误对象 ---
        // 这对于诊断 "fetch failed" 至关重要
        console.error("[Proxy] Vercel 代理 fetch 失败:", error);

        // error.cause 经常包含超时的详细信息
        if (error.cause) {
            console.error("[Proxy] Fetch 失败原因 (Error Cause):", error.cause);
        }

        // --- 返回更明确的超时错误信息 ---
        let errorMessage = `代理服务器内部错误: ${error.message}`;
        if (error.message && error.message.includes('fetch failed')) {
            // 捕获到原始的 fetch failed，提供更友好的提示
            errorMessage = "代理请求后端(Hugging Face)超时或失败。这很可能是因为 HF 免费 Space 正在冷启动（休眠唤醒），或者发生了TLS错误。请在 1 分钟后重试。";
        }

        // --- 注意：将原始错误信息返回给前端，以便调试 ---
        response.status(500).json({ detail: errorMessage });
    }
}

