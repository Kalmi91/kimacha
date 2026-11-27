import { StyleSheet, View } from 'react-native';

import { DockActionButton, type DockActionButtonProps } from '@/components/learn/DockedAction';

// The twin of DockedAction for places that have no dock host: the same button (DockActionButton), not absolutely
// positioned, the full width of its parent.
export default function InlineAction(props: DockActionButtonProps) {
  return (
    <View style={styles.root}>
      <DockActionButton {...props} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { alignSelf: 'stretch', width: '100%' },
});
