/** 
 *
 * 2D nuclear fission chain reaction simulation
 * (c) Chris Williams, February 2020. MIT license. @diodesign on Twitter.
 *
 * This illustrates the process of chain reactions in nuclear fuel.
 * It heavily simplifies the physics to run within a web browser.
 * A future version will take into account collisions between atoms so that
 * as more Uranium fissions, the fuel is gradually forced apart, turning from
 * a solid into a liquid or gas, reducing the reaction until the chain ends.
 *
 * It creates a grid of Uranium-235 atoms and sprays them with neutrons.
 * Most neutrons will whizz by, a few are absorbed, and others will cause
 * the atoms to fission into 2 fragments and emit 2 or 3 other neutrons,
 * which will fly off and potentially hit more Uranium atoms that also
 * fission, emit neutrons, and continue the chain reaction. Energy is
 * released in each fission, which can be harnessed to generate electricity,
 * or cause destruction in the case of atomic weapons.
 *
 * The red circles are the Uranium-235 atoms, the green cirlces are the
 * 2 fragment atoms formed from the Uranium splitting in two, and the blue
 * dots are the neutrons.
 *
 * The chart on the right shows the total number of fissions (yellow),
 * the number of atoms present in the simulation (red), and the number
 * of neutrons present (blue). When an atom or neutron leaves the simulation,
 * it is discarded. The atom count in the chart and in the status bar along
 * the top includes the number of Uranium and fragment atoms.
 *
 * Press Play in the editor.P5JS.org environment to start it. When all
 * atoms or neutrons have left the simulation, or if it has been running
 * for a certain amount of time, it automatically restarts.
 *
 * Click the left mouse button in the simulation to inject an extra neutron.
 *
 * Change the variables below to tweak the simulation.
 *
 */

/**
 *
 * AtomDensity defines the number of Uranium atoms to start. Specifically, it
 * creates a grid of fissible atoms (AtomDensity - 1) by (AtomDensity - 1).
 * A value of 5 creates a mass that is sub-critical, and so you can see
 * neutrons flying by unable to hit any fissible atoms, and when fission
 * does occur, it rarely ends with all the atoms fissioning. Change it
 * to 20 to increase the density to that of fuel in an implosion-type
 * atom bomb, as used on Nagasaki in WW2 and as the primary
 * in thermonuclear weapons.
 *
 * StartingNeutrons defines the number of randomly placed neutrons at the
 * start of the simulation. By default, it scales to the number of atoms.
 *
 */
const AtomDensity = 10;
const StartingNeutrons = (AtomDensity / 10) + 1;

/**
 *
 * Change NeutronSpeed to change the speed of the process. Reducing it
 * slows down the illustration of the chain reaction so it can be observed
 * in detail. Increase it to more accurately portray the speed of neutrons.
 *
 * The speed of neutrons in the simulation are a random fraction
 * of NeutronSpeed. Thus, consider this variable the maximum initial speed.
 *
 */
const NeutronSpeed = 20;
const NeutronSize = 3;
const NeutronReflectionRate = 0.2;
const NeutronAbsorbRate = 0.1;

/**
 *
 * AtomCrossSection attempts to simulate the cross-section of Uranium-235.
 * Nuetrons moving too fast are unlikely to fission the atoms.
 * Neutrons moving faster than AtomCrossSection will not fission the fuel,
 * so change this variable to control the rate of the chain reaction.
 *
 */
const AtomsFissible = (AtomDensity - 1) * (AtomDensity - 1);
const AtomCrossSection = NeutronSpeed * NeutronSpeed * 0.03;
const AtomSplitSpeed = NeutronSpeed * 0.4;

/**
 * 
 * viewSize defines the width and height of the simulation view in pixels.
 * The chart on the right takes the same dimensions.
 *
 */
const viewSize = 480;
const AtomColor = 0;
const FragmentColor = 120;
const NeutronColor = 210;
const FissionColor = 50;
const ChartStep = 2;

/**
 *
 * Set scrollChart to true to make the chart scroll as the simulation
 * continues. When false, it will not scroll, showing just the initial
 * readings.
 *
 * frameRuntime defines the maximum run-time length of each simulation
 * in the number of frames rendered.
 *
 */
const scrollChart = false;
const frameRuntime = 600;

var atoms = [];
var neutrons = [];
var explosions = [];
var fissionChart = [];
var atomChart = [];
var neutronChart = [];
var fissions;
var chartOffset;

class Neutron {
  constructor(
  p = createVector(random(0, viewSize), random(0, viewSize)), s = NeutronSpeed) {
    this.radius = NeutronSize;
    this.color = NeutronColor;
    this.centerX = p.x;
    this.centerY = p.y;
    this.velocityX = random(-1, 1) * s;
    this.velocityY = random(-1, 1) * s;
  }

  update() {
    this.centerX += this.velocityX;
    this.centerY += this.velocityY;
  }
  
  reflect() {
    if (this.centerX > viewSize || this.centerX < 0)
      this.velocityX *= -1;
    
    if (this.centerY > viewSize || this.centerY < 0)
      this.velocityY *= -1;
  }

  draw() {
    fill(this.color, 100, 100);
    circle(this.centerX, this.centerY, this.radius);
  }

  get_coords() {
    return createVector(this.centerX, this.centerY);
  }
  
  get_speed() {
    return createVector(this.velocityX, this.velocityY);
  }
}

class Atom {
  constructor(
  p = createVector(random(0, viewSize), random(0, viewSize)),
  v = createVector(0, 0),
  r = (viewSize / AtomDensity) * 0.6,
  c = AtomColor,
  f = true) {
    this.radius = constrain(r, 0, NeutronSize * 10);
    this.color = c;
    this.centerX = p.x;
    this.centerY = p.y;
    this.velocityX = v.x;
    this.velocityY = v.y;
    this.fissionable = f;
  }

  draw() {
    fill(this.color, 100, 100);
    circle(this.centerX, this.centerY, this.radius);
  }

  update() {
    this.centerX += this.velocityX;
    this.centerY += this.velocityY;
  }
  
  get_coords() {
    return createVector(this.centerX, this.centerY);
  }

  collision(p)
  {
    if (dist(p.x, p.y, this.centerX, this.centerY) < this.radius / 2)
      return true;

    return false;
  }
  
  create_fragment() {
    if (this.is_fissionable() == false)
      return null;
    
    let vx = random(-1, 1) * AtomSplitSpeed;
    let vy = random(-1, 1) * AtomSplitSpeed;
    let p = this.get_coords();
    
    return new Atom(
      p,
      createVector(vx, vy),
      this.radius * 0.45,
      FragmentColor,
      false
      );
  }
  
  is_fissionable() {
    return this.fissionable;
  }
}

class Explosion {
  constructor(p)
  {
    this.centerX = p.x;
    this.centerY = p.y;
    this.maxRadius = (viewSize / AtomDensity) * 4;
    this.maxSteps = 10;
    this.step = this.maxSteps;
  }
  
  draw() {
    let radius = (this.maxRadius / this.maxSteps) *
        (this.maxSteps - this.step);
    
    fill(AtomColor, 75, (100 / this.maxSteps) * this.step);
    circle(this.centerX, this.centerY, radius);
    
    this.step--;
    if (this.step <= 0) return false;
    return true;
  }
}

function out_of_bounds(p) {
    if (p.x > viewSize || p.x < 0 || p.y > viewSize || p.y < 0)
      return true;
    
    return false;
}

function setup() {
  createCanvas(viewSize * 2, viewSize);
  colorMode(HSB);
}

function mouseClicked() {
  neutrons.push(new Neutron(createVector(mouseX, mouseY)));
  return false; // prevent default
}

function populate()
{
  atoms = [];
  neutrons = [];
  fissionChart = [];
  atomChart = [];
  neutronChart = [];
  fissions = 0;
  chartOffset = 0;
  frameCount = 0;
  
  let gapX = viewSize / AtomDensity;
  let gapY = viewSize / AtomDensity;
  
  for (let x = 1; x < AtomDensity; x++)
  {
    for (let y = 1; y < AtomDensity; y++)
    {
      atoms.push(new Atom(createVector(x * gapX, y * gapY)));
    }
  }
  
  for (let i = 0; i < StartingNeutrons; i++)
    neutrons.push(new Neutron());
}

function draw() {
  background(0);
  
  if (atoms.length == 0 || neutrons.length == 0 || frameCount > frameRuntime)
      populate();

  let chartX = 0;
  strokeWeight(2);
  stroke(0, 0, 100);
  line(viewSize, 0, viewSize, viewSize);
  line(viewSize, viewSize, viewSize * 2, viewSize);
  
  if (scrollChart == true && frameCount > viewSize / ChartStep) chartOffset++;
  for (let i = 1; i < (viewSize / ChartStep); i++)
  {
    let chartX1 = ChartStep * (i - 1);
    let chartX2 = ChartStep * i;
    let arrayIndex = i + chartOffset;
    
    if (fissionChart[i] !== 'undefined')
    {
      let v1 = fissionChart[arrayIndex - 1];
      let v2 = fissionChart[arrayIndex];
      stroke(FissionColor, 100, 100);
      line(chartX1 + viewSize, (viewSize / AtomsFissible) * (AtomsFissible - v1),
           chartX2 + viewSize, (viewSize / AtomsFissible) * (AtomsFissible - v2));
    }
    
    if (atomChart[i] !== 'undefined')
    {
      let v1 = atomChart[arrayIndex - 1];
      let v2 = atomChart[arrayIndex];
      let max = AtomsFissible * 2;
      stroke(AtomColor, 100, 100);
      line(chartX1 + viewSize, (viewSize / max) * (max - v1),
           chartX2 + viewSize, (viewSize / max) * (max - v2));
    }
    
    if (neutronChart[i] !== 'undefined')
    {
      let v1 = neutronChart[arrayIndex - 1];
      let v2 = neutronChart[arrayIndex];
      let max = AtomsFissible * 3;
      stroke(NeutronColor, 100, 100);
      line(chartX1 + viewSize, (viewSize / max) * (max - v1),
            chartX2 + viewSize, (viewSize / max) * (max - v2));
    }

  }
  noStroke();

  let neutronsToAdd = [];
  let atomsToKeep = [];

  while (atoms.length > 0)
  {
    let neutronsToKeep = [];
    let atom = atoms.pop();
    let keepAtom = true;
    
    while (neutrons.length > 0)
    {
      let neutron = neutrons.pop();
      let coords = neutron.get_coords();
      let speed = neutron.get_speed();
      
      if (atom.is_fissionable() == true &&
          speed.mag() < AtomCrossSection &&
          atom.collision(coords) == true)
      {
        if (random(0, 1) > NeutronAbsorbRate)
        {
          keepAtom = false;
          neutronsToAdd.push({coords, speed});
          atomsToKeep.push(atom.create_fragment());
          atomsToKeep.push(atom.create_fragment());
          explosions.push(new Explosion(atom.get_coords()));
          fissions++;
          break;
        }
      }
      else
      {
        neutronsToKeep.push(neutron);
      }
    }
    
    if (keepAtom == true || atom.is_fissionable() == false)
    {
      atomsToKeep.push(atom);
    }

    for (let neutron of neutrons)
      neutronsToKeep.push(neutron);
    neutrons = neutronsToKeep;
  }
  
  let explosionsToKeep = [];
  
  while (explosions.length > 0)
  {
    let explosion = explosions.pop();
    if (explosion.draw() == true)
      explosionsToKeep.push(explosion);
  }
  
  explosions = explosionsToKeep;
  
  atoms = [];
  
  while (atomsToKeep.length > 0)
  {
    let atom = atomsToKeep.pop();
    
    atom.update();
    
    if (out_of_bounds(atom.get_coords()) == false)
    {
      atom.draw();
      atoms.push(atom);
    }
  }
  
  for (let {coords, speed} of neutronsToAdd) {
    let newNeutrons = random(2, 4);
    let speedMag = speed.mag();
    
    for (let i = 0; i < newNeutrons; i++) {
      neutrons.push(new Neutron(coords, speedMag * random(0.9, 2)));
    }
  }
  
  let neutronsToKeep = [];
  
  while (neutrons.length > 0)
  {
    let neutron = neutrons.pop();
    neutron.draw();
    neutron.update();
    if (out_of_bounds(neutron.get_coords()) == true)
    {
      if (random(0, 1) < NeutronReflectionRate)
      {
        neutron.reflect();
        neutronsToKeep.push(neutron);
      }
    }
    else
      neutronsToKeep.push(neutron);
  }
  
  neutrons = neutronsToKeep;
  
  select("#atomcount").html(atoms.length);
  select("#neutroncount").html(neutrons.length);
  select("#fissioncount").html(fissions);
  atomChart.push(atoms.length);
  neutronChart.push(neutrons.length);
  fissionChart.push(fissions);
}