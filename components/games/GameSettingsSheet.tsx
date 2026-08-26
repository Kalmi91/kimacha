import { Modal, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import Colors from '@/constants/Colors';
import { useTheme } from '@/lib/ThemeContext';
import { t } from '@/lib/i18n';

// GAMES.md 3.: "séma-vezérelt beállítás-lap". A game screen describes its own
// settings as a small schema (SettingField[]) instead of hand-rolling a
// bottom sheet per game, every 4.x "Beállítás:" list in GAMES.md maps
// directly onto a `select` (a fixed set of choices) or a `stepper` (a bounded
// number) field, and a plain on/off maps onto `toggle`.
//
// Values persist through lib.games.scoring-adjacent getGameSettings/
// setGameSettings (lib/database.ts), the game screen owns that read/write, 
// this component only renders the schema and reports changes.

export type SettingField =
  | { key: string; type: 'select'; label: string; options: { value: string; label: string }[] }
  | { key: string; type: 'stepper'; label: string; min: number; max: number; step: number; format?: (v: number) => string }
  | { key: string; type: 'toggle'; label: string };

interface Props {
  visible: boolean;
  title: string;
  fields: SettingField[];
  values: Record<string, string | number | boolean>;
  onChange: (key: string, value: string | number | boolean) => void;
  onClose: () => void;
}

export default function GameSettingsSheet({ visible, title, fields, values, onChange, onClose }: Props) {
  const { theme } = useTheme();
  const colors = Colors[theme];
  const s = t();

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={[styles.sheet, { backgroundColor: colors.card }]} onPress={() => {}}>
          <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
          <ScrollView contentContainerStyle={styles.fields}>
            {fields.map((field) => (
              <View key={field.key} style={styles.row}>
                <Text style={[styles.label, { color: colors.text }]}>{field.label}</Text>
                {field.type === 'toggle' ? (
                  <Switch
                    value={!!values[field.key]}
                    onValueChange={(v) => onChange(field.key, v)}
                    trackColor={{ true: colors.tint }}
                  />
                ) : field.type === 'stepper' ? (
                  <View style={styles.stepper}>
                    <Pressable
                      style={[styles.stepBtn, { borderColor: colors.tint }]}
                      onPress={() => {
                        const cur = Number(values[field.key] ?? field.min);
                        onChange(field.key, Math.max(field.min, cur - field.step));
                      }}
                    >
                      <Text style={[styles.stepBtnText, { color: colors.tint }]}>−</Text>
                    </Pressable>
                    <Text style={[styles.stepValue, { color: colors.text }]}>
                      {field.format ? field.format(Number(values[field.key])) : String(values[field.key] ?? field.min)}
                    </Text>
                    <Pressable
                      style={[styles.stepBtn, { borderColor: colors.tint }]}
                      onPress={() => {
                        const cur = Number(values[field.key] ?? field.min);
                        onChange(field.key, Math.min(field.max, cur + field.step));
                      }}
                    >
                      <Text style={[styles.stepBtnText, { color: colors.tint }]}>+</Text>
                    </Pressable>
                  </View>
                ) : (
                  <View style={styles.chips}>
                    {field.options.map((opt) => {
                      const selected = values[field.key] === opt.value;
                      return (
                        <Pressable
                          key={opt.value}
                          style={[
                            styles.chip,
                            { borderColor: colors.tint },
                            selected ? { backgroundColor: colors.tint } : null,
                          ]}
                          onPress={() => onChange(field.key, opt.value)}
                        >
                          <Text style={selected ? styles.chipTextSelected : [styles.chipText, { color: colors.tint }]}>
                            {opt.label}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                )}
              </View>
            ))}
          </ScrollView>
          <Pressable style={[styles.closeBtn, { backgroundColor: colors.tint }]} onPress={onClose}>
            <Text style={styles.closeBtnText}>{s.games.settingsDone}</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    maxHeight: '75%',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12,
  },
  fields: {
    gap: 16,
    paddingBottom: 8,
  },
  row: {
    gap: 8,
  },
  label: {
    fontSize: 15,
    fontWeight: '600',
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  stepBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBtnText: {
    fontSize: 18,
    fontWeight: '700',
  },
  stepValue: {
    fontSize: 16,
    fontWeight: '600',
    minWidth: 48,
    textAlign: 'center',
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
  },
  chipText: {
    fontWeight: '600',
  },
  chipTextSelected: {
    fontWeight: '600',
    color: '#FFFFFF',
  },
  closeBtn: {
    marginTop: 16,
    paddingVertical: 14,
    borderRadius: 24,
    alignItems: 'center',
  },
  closeBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
});
