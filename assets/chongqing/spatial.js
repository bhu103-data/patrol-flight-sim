// Spatially indexed, conservative building collisions for Chongqing Pilot.
// Zero temporary arrays/vectors allocated for the frequent position and camera queries.
export class SpatialObstacleIndex {
  constructor(obstacles, cellSize=72){
    this.cellSize=cellSize;
    this.cells=new Map();
    this.obstacleCount=obstacles.length;
    for(const building of obstacles){
      const margin=2;
      const minX=Math.floor((building.x-building.w*.5-margin)/cellSize);
      const maxX=Math.floor((building.x+building.w*.5+margin)/cellSize);
      const minZ=Math.floor((building.z-building.d*.5-margin)/cellSize);
      const maxZ=Math.floor((building.z+building.d*.5+margin)/cellSize);
      for(let ix=minX;ix<=maxX;ix++)for(let iz=minZ;iz<=maxZ;iz++){
        const key=ix+','+iz;
        let cell=this.cells.get(key);
        if(!cell){cell=[];this.cells.set(key,cell);}
        cell.push(building);
      }
    }
  }

  eachNear(x,z,r,visit){
    const c=this.cellSize;
    const minX=Math.floor((x-r)/c),maxX=Math.floor((x+r)/c);
    const minZ=Math.floor((z-r)/c),maxZ=Math.floor((z+r)/c);
    for(let ix=minX;ix<=maxX;ix++){
      for(let iz=minZ;iz<=maxZ;iz++){
        const cell=this.cells.get(ix+','+iz);
        if(!cell)continue;
        for(let i=0;i<cell.length;i++)if(visit(cell[i]))return true;
      }
    }
    return false;
  }

  // Player center y is ~2.35 m above the foot contact point.
  // A player just above a roof remains outside its side collider.
  collides(x,y,z,r=.82){
    return this.eachNear(x,z,r,b=>
      Math.abs(x-b.x)<b.w*.5+r &&
      Math.abs(z-b.z)<b.d*.5+r &&
      y-2.2<b.top-.08 &&
      y+1.05>(b.base??-10000)
    );
  }

  // Only accept a rooftop when descending to it from above. Never teleport
  // a player up through a building from the street underneath it.
  landingSurface(x,z,previousY,nextY,groundY,clearance=2.35){
    let floor=groundY+clearance;
    if(nextY>previousY+.02)return floor;
    this.eachNear(x,z,.18,b=>{
      if(Math.abs(x-b.x)>=b.w*.5-.02||Math.abs(z-b.z)>=b.d*.5-.02)return false;
      const roof=b.top+clearance;
      if(previousY>=roof-.15 && nextY<=roof+.12 && roof>floor)floor=roof;
      return false;
    });
    return floor;
  }
}
