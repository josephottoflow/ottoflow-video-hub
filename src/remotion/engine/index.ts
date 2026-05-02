/**
 * SMART ANIMATION ENGINE — Public API
 */
export { classifyImages, getByCategory, classificationSummary } from "./classifyImage";
export { assignImagesToScenes, logAssignment } from "./assignScenes";
export { resolveTheme, getLighting, ambientGlowCSS, depthShadowCSS, THEME_CONFIGS } from "./lightingEngine";
export { generateVariant, getSceneTiming, generateParticles } from "./animationVariants";
export { generateCameraConfig, generateAllCameraConfigs, logCameraConfigs } from "./cameraEngine";
export { generateTransitionConfig, generateAllTransitionConfigs, logTransitionConfigs } from "./transitionEngine";
export { generateHookConfig, generateHookOptions } from "./hookEngine";
export { selectBestImages, selectBestImagePaths, logSelection } from "./imageSelector";
export { getTextStyle, getTextAnim, getTextPalette, generateSceneTextConfig, getHeadlineFont, getBodyFont, ensureContrast } from "./textEngine";
export { getTextLayout, getPositionCSS, adaptFontSize, isReadable, SAFE_AREA } from "./textLayout";
export * from "./types";
