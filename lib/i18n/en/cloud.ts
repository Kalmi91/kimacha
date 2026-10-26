// The web sign-in screen (components/cloud/CloudLogin.tsx) and the progress loading around it.
export default {
  cloud: {
    title: 'Sign in to keep your progress',
    hint: 'A new name creates a new account. Use the same name and PIN on any device.',
    nameLabel: 'Name',
    namePlaceholder: 'Your name',
    pinLabel: 'PIN',
    pinPlaceholder: '4 digits',
    submit: 'Sign in',
    errorBadPin: 'Wrong PIN. Try again.',
    errorLocked: (minutes: number) => `Too many wrong PINs. Try again in ${minutes} min.`,
    errorNetwork: 'No connection. Check your internet and try again.',
    errorBadInput: 'Enter a name (2-24 characters) and a 4-digit PIN.',
    errorServer: 'Something went wrong. Try again in a moment.',
    loading: 'Loading your progress...',
    loadFailed: 'Could not load your progress.',
    retry: 'Try again',
    backToLogin: 'Back to sign-in',
  },
};
