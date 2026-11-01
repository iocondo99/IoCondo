import type { INavVoce } from '@iocondo/shared-types';
import { iconMap, type IconName } from '@iocondo/ui';

/** Icona Lucide della voce; se il nome non è nel set del design system si usa un'icona neutra. */
export function iconaDi(voce: INavVoce): IconName {
  return voce.icon in iconMap ? (voce.icon as IconName) : 'circle-help';
}
