/*
 * Synapar Public API
 * POST /api/synapar_api_inference
 */
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
        console.error("[Public API] Vercel 环境变量 HF_API_URL 或 HF_ACCESS_TOKEN 未设置");
        response.status(500).json({ detail: "服务器代理配置错误" });
        return;
    }

    console.log(`[Public API] 正在处理 /api/synapar_api_inference 的 POST 请求`);

    try {
        const originalBody = request.body;

        // --- 3. API 输入验证 ---
        // 验证必需的字段
        const { kline_data, frequency } = originalBody;

        if (!kline_data || !Array.isArray(kline_data) || kline_data.length === 0) {
            response.status(400).json({ detail: "Request body error" });
            return;
        }

        // 简单检查 K 线数据形状
        if (!Array.isArray(kline_data[0]) || kline_data[0].length !== 7) {
             response.status(400).json({ detail: "Request body error" });
            return;
        }

        if (!frequency || typeof frequency !== 'string') {
            response.status(400).json({ detail: "Request body error" });
            return;
        }

        // --- 4. 强制添加 source: 'api' ---
        // 创建一个新的请求体，强制 source 字段为 'api'
        const modifiedBody = {
            ...originalBody,
            source: 'api' // 确保此API的调用源始终为 'api'
        };

        // 5. 将请求转发到 Hugging Face
        console.log(`[Public API] 正在转发 (source: 'api') 请求至: ${HF_API_URL}`);
        const hfResponse = await fetch(HF_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${hfToken}`
            },
            body: JSON.stringify(modifiedBody),
        });

        // 6. 处理 HF 响应
        const contentType = hfResponse.headers.get("content-type");

        if (hfResponse.ok && contentType && contentType.includes("application/json")) {
            // 6a. 成功: 2xx 状态码 且 Content-Type 是 JSON
            console.log("[Public API] 成功从 HF API 获取数据并返回给API调用者");
            const data = await hfResponse.json();
            response.status(200).json(data);
        } else {
            // 6b. 失败: 非 2xx 状态码, 或者 Content-Type 不是 JSON
            const errorText = await hfResponse.text();
            console.error(`[Public API] Hugging Face API 错误: 状态码 ${hfResponse.status}`);
            console.error(`[Public API] HF 响应 (非JSON): ${errorText.substring(0, 200)}...`);

            // 将 HF 的错误状态码和文本详情转发给前端
            response.status(hfResponse.status).json({
                detail: `Hugging Face API Error (Status ${hfResponse.status})`,
                hf_response_body: errorText
            });
        }

    } catch (error) {
        // 7. Vercel 内部错误
        console.error("[Public API] Vercel 代理 fetch 失败:", error);
        response.status(500).json({ detail: `代理服务器内部错误: ${error.message}` });
    }
}
