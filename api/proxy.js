export default async function handler(request, response) {
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
            body: JSON.stringify(request.body)
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

        response.status(500).json({ detail: `代理服务器内部错误: ${error.message}` });
    }
}
