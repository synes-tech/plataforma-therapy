import profile from '@/assets/fotoperfilthery.png';
import happy from '@/assets/fototheryfelizbracolevantado.png';
import pointing from '@/assets/fotoapontandopraesquerda.png';
import sad from '@/assets/theryfototriste.png';

export type TheryPose = 'profile' | 'happy' | 'pointing' | 'sad';

export const THERY_POSES: Record<TheryPose, string> = {
  profile,
  happy,
  pointing,
  sad,
};

/** Avatar oficial da Ivy no chat, header e ícone da IA. */
export const THERY_AVATAR_SRC = profile;
