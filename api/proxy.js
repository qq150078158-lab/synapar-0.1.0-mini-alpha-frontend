export default async function handler(request, response) {
    // 1. 仅允许 POST 请求
    if (request.method !== 'POST') {
        response.status(405).json({ detail: 'Method Not Allowed' });
        return;
    }

    // 2. 从 Vercel 环境变量中获取机密信息
    // (您必须在 Vercel 项目设置中配置它们)
    const HF_API_URL = process.env.HF_API_URL;
    const HF_API_TOKEN = process.env.HF_API_TOKEN;

    if (!HF_API_URL || !HF_API_TOKEN) {
        console.error("Vercel 环境变量 HF_API_URL 或 HF_API_TOKEN 未设置");
        response.status(500).json({ detail: "服务器代理配置错误" });
        return;
    }

    try {
        // 3. 将前端的请求转发到 Hugging Face
        const hfResponse = await fetch(HF_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                // --- 在这里（后端）添加秘密 Token ---
                'Authorization': `Bearer ${HF_API_TOKEN}`
            },
            // 将前端发送的 body (e.g., stock_code) 原封不动地转发
            body: JSON.stringify(request.body)
        });

        // 4. 处理来自 Hugging Face 的响应
        if (!hfResponse.ok) {
            // 如果 HF API 返回错误，将错误详情转发给前端
            const errorData = await hfResponse.json();
            console.error("Hugging Face API 错误:", errorData);
            response.status(hfResponse.status).json(errorData);
        } else {
            // 如果成功，将数据转发给前端
            const data = await hfResponse.json();
            response.status(200).json(data);
        }

    } catch (error) {
        console.error("Vercel 代理 fetch 失败:", error);
        response.status(500).json({ detail: `代理服务器内部错误: ${error.message}` });
    }
}
