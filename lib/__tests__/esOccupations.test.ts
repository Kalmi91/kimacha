import { occupationFeminine } from '../esOccupations';

describe('occupationFeminine', () => {
  it('-o → -a and -or → -ora for the listed person nouns', () => {
    expect(occupationFeminine('secretario')).toBe('secretaria');
    expect(occupationFeminine('abogado')).toBe('abogada');
    expect(occupationFeminine('científico')).toBe('científica');
    expect(occupationFeminine('mecánico')).toBe('mecánica');
    expect(occupationFeminine('escritor')).toBe('escritora');
    expect(occupationFeminine('director')).toBe('directora');
  });

  it('the pairs that go their own way', () => {
    expect(occupationFeminine('bailarín')).toBe('bailarina');
    expect(occupationFeminine('alcalde')).toBe('alcaldesa');
    expect(occupationFeminine('juez')).toBe('jueza');
  });

  it('is a list, not a rule: an -o noun that is not a listed person has no feminine', () => {
    expect(occupationFeminine('libro')).toBeNull();
    expect(occupationFeminine('gato')).toBeNull();
    expect(occupationFeminine('doctor')).toBeNull();
    expect(occupationFeminine('estudiante')).toBeNull();
  });
});
