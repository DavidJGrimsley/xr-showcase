import SettingsScreen from '../features/settings/settings-screen';
import { createPlaceholderAuthAdapter } from '../features/settings/settings-screen-logic';

export default function SettingsRoute() {
  return <SettingsScreen auth={createPlaceholderAuthAdapter()} />;
}
