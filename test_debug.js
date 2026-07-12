const e = new Error('Google token refresh failed');
e.response = { data: { error: 'invalid_client' } };
console.log(e.response?.data?.error);
