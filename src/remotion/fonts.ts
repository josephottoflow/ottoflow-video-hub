import { loadFont as loadBebasNeue,     fontFamily as bebasFontFamily     } from "@remotion/google-fonts/BebasNeue";
import { loadFont as loadSpaceGrotesk,  fontFamily as spaceGroteskFamily   } from "@remotion/google-fonts/SpaceGrotesk";
import { loadFont as loadOswald,        fontFamily as oswaldFamily          } from "@remotion/google-fonts/Oswald";
import { loadFont as loadMontserrat,    fontFamily as montserratFamily      } from "@remotion/google-fonts/Montserrat";
import { loadFont as loadPlayfair,      fontFamily as playfairFamily        } from "@remotion/google-fonts/PlayfairDisplay";

loadBebasNeue();
loadSpaceGrotesk();
loadOswald();
loadMontserrat();
loadPlayfair();

export const BEBAS         = bebasFontFamily;
export const SPACE_GROTESK = spaceGroteskFamily;
export const OSWALD        = oswaldFamily;
export const MONTSERRAT    = montserratFamily;
export const PLAYFAIR      = playfairFamily;
