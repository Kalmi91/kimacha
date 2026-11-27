import { StyleSheet, View } from 'react-native';

import { ActionButton, type ActionButtonProps } from '@/components/learn/DockedAction';

// The twin of DockedAction for places that have no dock host: the same button (ActionButton), not absolutely
// positioned, the full width of its parent.
export default function InlineAction(props: ActionButtonProps) {
  return (
    <View style={styles.root}>
      <ActionButton {...props} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { alignSelf: 'stretch', width: '100%' },
});
