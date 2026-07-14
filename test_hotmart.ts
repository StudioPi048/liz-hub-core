import dotenv from 'dotenv';
dotenv.config();

async function authenticateHotmart(): Promise<string | null> {
  const clientId = process.env.HOTMART_CLIENT_ID;
  const clientSecret = process.env.HOTMART_CLIENT_SECRET;
  
  const tokenParams = new URLSearchParams();
  tokenParams.append("grant_type", "client_credentials");
  tokenParams.append("client_id", clientId!);
  tokenParams.append("client_secret", clientSecret!);

  const basicToken = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
  
  const res = await fetch("https://api-sec-vlc.hotmart.com/security/oauth/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "Authorization": `Basic ${basicToken}`
    },
    body: tokenParams.toString()
  });

  if (!res.ok) {
    console.error("Auth failed:", await res.text());
    return null;
  }
  const data = await res.json();
  return data.access_token;
}

async function test() {
  const token = await authenticateHotmart();
  if (!token) return;

  const listRes = await fetch("https://developers.hotmart.com/products/api/v1/products", {
    headers: { "Authorization": `Bearer ${token}` }
  });
  
  if (!listRes.ok) {
    console.error("List failed:", listRes.status, await listRes.text());
    return;
  }
  
  const listData = await listRes.json();
  if (listData.items && listData.items.length > 0) {
    console.log("First Product:", JSON.stringify(listData.items[0], null, 2));
  } else {
    console.log("No items found");
  }
}
test();
