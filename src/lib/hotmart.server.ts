export async function authenticateHotmart(): Promise<string | null> {
  const clientId = process.env.HOTMART_CLIENT_ID;
  const clientSecret = process.env.HOTMART_CLIENT_SECRET;
  const basicToken = process.env.HOTMART_BASIC_TOKEN;

  if (!basicToken && (!clientId || !clientSecret)) {
     console.error("Credenciais do Hotmart não configuradas (.env)");
     return null;
  }

  const tokenParams = new URLSearchParams();
  tokenParams.append("grant_type", "client_credentials");
  
  if (clientId && clientSecret) {
    tokenParams.append("client_id", clientId);
    tokenParams.append("client_secret", clientSecret);
  }

  const headers: Record<string, string> = {
     "Content-Type": "application/x-www-form-urlencoded"
  };

  if (basicToken) headers["Authorization"] = `Basic ${basicToken}`;

  try {
    const res = await fetch("https://api-sec-vlc.hotmart.com/security/oauth/token", {
      method: "POST", headers, body: tokenParams.toString()
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.access_token;
  } catch (e) {
    return null;
  }
}

export interface HotmartProductDetails {
  id: number;
  name: string;
  description?: string;
  ucb?: string;
}

export async function getHotmartProductDetails(productId: string | number): Promise<HotmartProductDetails | null> {
  const token = await authenticateHotmart();
  if (!token) return null;
  try {
    const res = await fetch(`https://developers.hotmart.com/product/rest/v1/products/${productId}`, {
      headers: { "Authorization": `Bearer ${token}` }
    });
    if (!res.ok) return null;
    return await res.json();
  } catch(e) {
    return null;
  }
}
