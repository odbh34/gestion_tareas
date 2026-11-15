import { useState } from 'react';

export default function PasswordInput(props) {
  const [visible, setVisible] = useState(false);

  return (
    <span className="password-input">
      <input {...props} type={visible ? 'text' : 'password'} />
      <button
        type="button"
        className="password-toggle"
        aria-label={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
        aria-pressed={visible}
        onClick={() => setVisible((current) => !current)}
      >
        <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
          <circle cx="12" cy="12" r="3" />
          {visible && <path d="M4 4l16 16" />}
        </svg>
      </button>
    </span>
  );
}
