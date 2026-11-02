import type en from '../en/cloud';

const de: typeof en = {
  cloud: {
    title: 'Melde dich an, damit dein Fortschritt gespeichert bleibt',
    hint: 'Ein neuer Name legt ein neues Konto an. Mit demselben Namen und derselben PIN machst du auf jedem Gerät weiter.',
    nameLabel: 'Name',
    namePlaceholder: 'Dein Name',
    pinLabel: 'PIN',
    pinPlaceholder: '4 Ziffern',
    submit: 'Anmelden',
    errorBadPin: 'Falsche PIN. Versuche es noch einmal.',
    errorLocked: (minutes: number) => `Zu viele falsche PINs. Versuche es in ${minutes} Min. noch einmal.`,
    errorNetwork: 'Keine Verbindung. Prüfe dein Internet und versuche es noch einmal.',
    errorBadInput: 'Gib einen Namen (2-24 Zeichen) und eine 4-stellige PIN ein.',
    errorServer: 'Etwas ist schiefgelaufen. Versuche es gleich noch einmal.',
    loading: 'Dein Fortschritt wird geladen...',
    loadFailed: 'Dein Fortschritt konnte nicht geladen werden.',
    retry: 'Noch einmal',
    backToLogin: 'Zurück zur Anmeldung',
  },
};

export default de;
