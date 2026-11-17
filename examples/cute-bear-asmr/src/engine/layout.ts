import * as THREE from 'three';

// World layout (Y up, camera looks down -Z, 1 unit ~ the bear's height).
export const TABLE_Y = 0.33; // top of the tablecloth
export const TABLE_Z0 = -0.12; // back edge (bear side)
export const TABLE_Z1 = 0.36; // front edge (camera side)
export const BEAR_Z = -0.29; // where the bear stops behind the table
export const WALL_Z = -2.3;

export const PLATE_TOP = 0.009; // inner surface height of a plate
export const BOWL_TOP = 0.012;

// Serving dishes (the bear's right paw is -X = screen left).
export const COOKIE_PLATE = new THREE.Vector3(-0.215, TABLE_Y, -0.02);
export const MARSH_BOWL = new THREE.Vector3(-0.078, TABLE_Y, 0.09);
export const STRAW_BOWL = new THREE.Vector3(0.085, TABLE_Y, 0.09);
export const LEMON_PLATE = new THREE.Vector3(0.215, TABLE_Y, -0.02);
