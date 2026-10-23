import type en from '../en/cloud';

const es: typeof en = {
  cloud: {
    title: 'Inicia sesión para guardar tu progreso',
    hint: 'Un nombre nuevo crea una cuenta nueva. Usa el mismo nombre y PIN en cualquier dispositivo.',
    nameLabel: 'Nombre',
    namePlaceholder: 'Tu nombre',
    pinLabel: 'PIN',
    pinPlaceholder: '4 dígitos',
    submit: 'Entrar',
    errorBadPin: 'PIN incorrecto. Inténtalo de nuevo.',
    errorLocked: (minutes: number) => `Demasiados PIN incorrectos. Inténtalo de nuevo en ${minutes} min.`,
    errorNetwork: 'Sin conexión. Revisa tu internet e inténtalo de nuevo.',
    errorBadInput: 'Escribe un nombre (2-24 caracteres) y un PIN de 4 dígitos.',
    errorServer: 'Algo salió mal. Inténtalo de nuevo en un momento.',
    loading: 'Cargando tu progreso...',
    loadFailed: 'No se pudo cargar tu progreso.',
    retry: 'Reintentar',
    backToLogin: 'Volver al inicio de sesión',
  },
};

export default es;
