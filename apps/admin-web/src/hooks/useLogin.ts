'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { services } from '@/services';

export function useLogin() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    setLoading(true);
    setError(null);
    try {
      await services.auth.signIn(email, password);
      router.push('/');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Accesso non riuscito');
    } finally {
      setLoading(false);
    }
  };

  return { email, setEmail, password, setPassword, error, loading, submit };
}
