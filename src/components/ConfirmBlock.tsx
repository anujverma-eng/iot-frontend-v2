// src/components/ConfirmBlock.tsx
import { Button, InputOtp, addToast } from '@heroui/react';
import React from 'react';
import { useAppDispatch, useAppSelector } from '../hooks/useAppDispatch';
import { confirmCode, resendCode, tick } from '../store/confirmationSlice';

export function ConfirmBlock({
  onSuccess,
  skipApi = false,                 // ← use this in forgot‑pw step1
}: {
  onSuccess: (code?: string) => void;
  skipApi?: boolean;
}) {
  const { expiresAt, remaining, email, flow, pendingEmail } = useAppSelector((s) => s.confirmation);
  const dispatch = useAppDispatch();

  const [code, setCode] = React.useState('');
  const [sec, setSec]   = React.useState(0);

  /* timer ------------------------------------------------------- */
  React.useEffect(() => {
    if (!expiresAt) return;
    const id = setInterval(() => {
      dispatch(tick());
      setSec(Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000)));
    }, 1_000);
    return () => clearInterval(id);
  }, [expiresAt, dispatch]);

  /* submit ------------------------------------------------------ */
  const confirm = async () => {
    try {
      if (!skipApi) {
        await dispatch(confirmCode({ code })).unwrap();
      }
      onSuccess(code);
    } catch (e: any) {
      addToast({ title: 'Invalid code', description: e.message, color: 'danger' });
    }
  };

  // Determine display email and title based on flow
  const displayEmail = flow === 'email-change' ? pendingEmail : email;
  const title = flow === 'signup' ? 'Verify your e‑mail' : 
               flow === 'email-change' ? 'Verify your new email' : 
               'Enter verification code';

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-xl font-semibold text-foreground">
        {title}
      </h2>

      <p className="text-default-500 text-sm">
        We sent a 6-digit code to <strong>{displayEmail}</strong>
      </p>

      <InputOtp
        length={6}
        value={code}
        onValueChange={setCode}
        classNames={{ input: 'w-12 h-12 text-lg', base: 'gap-2' }}
      />

      <Button color="primary" onPress={confirm} isDisabled={code.length !== 6}>
        Confirm
      </Button>

      <p className="text-center text-xs text-default-600">
        {remaining === 0 ? (
          'Resend limit reached'
        ) : expiresAt ? (
          `Resend in ${sec}s`
        ) : (
          <Button
            size="sm"
            variant="light"
            onPress={() => dispatch(resendCode())}
          >
            Resend code ({remaining} left)
          </Button>
        )}
      </p>
    </div>
  );
}
