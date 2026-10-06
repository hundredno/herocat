import { Color, DirectionalLight, Fog, HemisphereLight, PointLight } from 'three';

/**
 * Every level uses the same light setup (hemisphere + sun + one point light that follows
 * the hero), so switching levels never recompiles shaders.
 */
export function setupLights(scene, { sky, ground, hemi, sun, sunColor = 0xffffff, lamp = 0, lampColor = 0xffc78a, bg }) {
  const hemiLight = new HemisphereLight(sky, ground, hemi);
  const sunLight = new DirectionalLight(sunColor, sun);
  sunLight.position.set(-6, 14, 9);
  const lampLight = new PointLight(lampColor, lamp, 18, 1.4);
  scene.add(hemiLight, sunLight, lampLight);
  scene.background = new Color(bg);
  scene.fog = new Fog(bg, 30, 70);
  return { hemi: hemiLight, sun: sunLight, lamp: lampLight };
}
