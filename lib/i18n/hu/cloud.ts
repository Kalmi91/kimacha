import type en from '../en/cloud';

const hu: typeof en = {
  cloud: {
    title: 'Lépj be, hogy megmaradjon a haladásod',
    hint: 'Új névvel új fiók készül. Ugyanazzal a névvel és PIN-nel bármelyik eszközön folytathatod.',
    nameLabel: 'Név',
    namePlaceholder: 'A neved',
    pinLabel: 'PIN',
    pinPlaceholder: '4 számjegy',
    submit: 'Belépés',
    errorBadPin: 'Rossz PIN. Próbáld újra.',
    errorLocked: (minutes: number) => `Túl sok rossz PIN. Próbáld újra ${minutes} perc múlva.`,
    errorNetwork: 'Nincs kapcsolat. Nézd meg az internetet, és próbáld újra.',
    errorBadInput: 'Írj be egy nevet (2-24 karakter) és egy 4 jegyű PIN-t.',
    errorServer: 'Valami hiba történt. Próbáld újra egy kicsit később.',
    loading: 'Töltöm a haladásodat...',
    loadFailed: 'Nem sikerült betölteni a haladásodat.',
    retry: 'Újra',
    backToLogin: 'Vissza a belépéshez',
  },
};

export default hu;
