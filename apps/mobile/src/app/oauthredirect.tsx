import { Redirect, useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';

import { deliverGoogleIdToken } from '@/lib/google-oauth-return';

export default function OauthRedirectRoute() {
  const params = useLocalSearchParams<{ id_token?: string | string[] }>();

  useEffect(() => {
    const fromParams = Array.isArray(params.id_token) ? params.id_token[0] : params.id_token;
    const token = fromParams?.trim();
    if (token) deliverGoogleIdToken(token);
  }, [params.id_token]);

  return <Redirect href="/auth" />;
}
