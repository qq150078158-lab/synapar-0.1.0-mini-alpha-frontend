export default async function handler(request, response) {
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

    // 1. 仅允许 POST 请求
    if (request.method !== 'POST') {
        response.status(405).json({ detail: 'Method Not Allowed' });
        return;
    }

    // 2. 环境变量
    const HF_API_URL = process.env.HF_API_URL;
    const hfToken = process.env.HF_ACCESS_TOKEN;

    if (!HF_API_URL || !hfToken) {
        console.error("Vercel 环境变量 HF_API_URL 或 HF_ACCESS_TOKEN 未设置");
        response.status(500).json({ detail: "服务器代理配置错误" });
        return;
    }

    // --- 打印目标 URL ---
    console.log(`[Proxy] 正在转发 POST 请求至: ${HF_API_URL}`);

    try {
        // 1. 获取前端发送的原始请求体
        const originalBody = request.body;

        // 2. 创建一个新的请求体，强制 source 字段为 'web'
        const modifiedBody = {
            ...originalBody,
            source: 'web' // 确保此代理的调用源始终为 'web'
        };

        console.log(`[Proxy] 转发 (source: 'web') 请求体`);

        // 3. 将请求转发到 Hugging Face
        const hfResponse = await fetch(HF_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${hfToken}`
            },
            body: JSON.stringify(modifiedBody),
        });

        // 检查响应头
        const contentType = hfResponse.headers.get("content-type");

        if (hfResponse.ok && contentType && contentType.includes("application/json")) {
            // 4a. 成功: 2xx 状态码 且 Content-Type 是 JSON
            console.log("[Proxy] 成功从 HF API 获取数据并返回给前端");
            const data = await hfResponse.json();
            response.status(200).json(data);
        } else {
            // 4b. 失败: 非 2xx 状态码, 或者 Content-Type 不是 JSON

            // 将响应体读取为文本，避免 JSON 解析错误
            const errorText = await hfResponse.text();

            if (!hfResponse.ok) {
                // 非 2xx 错误 (e.g., 401, 403, 500)
                console.error(`[Proxy] Hugging Face API 错误: 状态码 ${hfResponse.status}`);
                // 打印HTML响应的开头，帮助诊断
                console.error(`[Proxy] HF 响应 (非JSON): ${errorText.substring(0, 200)}...`);

                // 将 HF 的错误状态码和文本详情转发给前端
                response.status(hfResponse.status).json({
                    detail: `Hugging Face API Error (Status ${hfResponse.status})`,
                    hf_response_body: errorText // 将 HTML 错误发给前端
                });
            } else {
                // 2xx 成功状态码, 但是响应不是 JSON (这就是当前日志显示的情况)
                console.error(`[Proxy] HF 响应格式错误: 预期 application/json，但收到 ${contentType}`);
                console.error(`[Proxy] HF 响应 (HTML/Text): ${errorText.substring(0, 200)}...`);

                response.status(500).json({
                    detail: "代理错误：后端(HF)返回了非JSON格式的成功响应",
                    hf_response_body: errorText // 将 HTML 响应发给前端
                });
            }
        }

    } catch (error) {
        // --- 打印完整的错误对象 ---
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

        // --- 将原始错误信息返回给前端，以便调试 ---
        response.status(500).json({ detail: errorMessage });
    }
}

