import { useLocalSearchParams } from 'expo-router';

import { EditPostScreen } from '@/features/posts';

export default function EditPost() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <EditPostScreen id={id} />;
}
