namespace org.ssatguru.babylonjs.vishva {

    import Mesh=BABYLON.Mesh;
    import GroundMesh=BABYLON.GroundMesh;
    import Vector2=BABYLON.Vector2;
    import Vector3=BABYLON.Vector3;
    import Random=org.ssatguru.babylonjs.util.Random;
    import SolidParticle=BABYLON.SolidParticle;
    
    /**
     * Manages a SPS whose particles are spread over a gound mesh.
     */
    export class GroundSPS {

        private _vishva:Vishva;
        private _mesh:Mesh;
        private _groundMesh:GroundMesh;
        
        private _spreadDtls:SpreadDtls;
        public sps:Mesh;

        private sx: number=0;
        private sz: number=0;
        private sXmin: number=0;
        private sXmax: number=0;
        private sZmin: number=0;
        private sZmax: number=0;
        private sCount: number=0;

        private _rand: Random;
        
        constructor(vishva:Vishva,mesh:Mesh,groundMesh:GroundMesh, spreadDtls:SpreadDtls){
            this._vishva=vishva;
            this._mesh=mesh;
            this._groundMesh=groundMesh;
            this._spreadDtls=spreadDtls;
            this._rand=new Random(this._spreadDtls.seed);
            this._setSpreadParms(mesh,groundMesh,spreadDtls);
            let SPS=new BABYLON.SolidParticleSystem('SPS',this._vishva.scene,{updatable: false,isPickable: false});
            SPS.addShape(this._mesh,this.sCount,{positionFunction: (p,i,s) => {this._spread(p);}});
            this.sps=SPS.buildMesh();
            this.sps.material=this._mesh.material;
            this.sps.doNotSerialize=true;
        }
        
        public serialize():GroundSPSserialized{
            return {
                meshID:this._mesh.id,
                groundMeshID: this._groundMesh.id,
                spreadDtls: this._spreadDtls
            };
        }
        
        private _setSpreadParms(m:Mesh,gm:GroundMesh,sd:SpreadDtls) {

            if(!sd.step)
                sd.step=m.getBoundingInfo().boundingSphere.radius;
                
            this.sXmin=gm._minX+sd.step;
            this.sZmin=gm._minZ+sd.step;
            this.sXmax=gm._maxX-sd.step;
            this.sZmax=gm._maxZ-sd.step;
            this.sCount=(gm._width/sd.step-1)*(gm._height/sd.step-1);

            this.sx=this.sXmin;
            this.sz=this.sZmax;
            
            if (!sd.posRange) sd.posRange=0.5;
            if (!sd.sclRange) sd.sclRange=0.5;
            if (!sd.rotRange) sd.rotRange=Math.PI/20;
            
            let n: number;
            if(!sd.posMax) {
                n=sd.step*sd.posRange;
                sd.posMax=new Vector3(n,n,n);
            }
            if(!sd.posMin) {
                n=-sd.step*sd.posRange;
                sd.posMin=new Vector3(n,n,n);
            }
            if(!sd.sclMax) {
                n=(1+sd.sclRange);
                sd.sclMax=new Vector3(n,n,n);
            }
            if(!sd.sclMin) {
                n=(1-sd.sclRange);
                sd.sclMin=new Vector3(n,n,n);
            }
            if(!sd.rotMax) {
                n=(sd.rotRange);
                sd.rotMax=new Vector3(n,n,n);
            }
            if(!sd.rotMin) {
                n=(-sd.rotRange);
                sd.rotMin=new Vector3(n,n,n);
            }
            
            console.log(sd);
        }
        
        private _spread(part: SolidParticle) {
            //position
            part.position.x=this.sx+this._rand.generate(this._spreadDtls.posMin.x,this._spreadDtls.posMax.x);
            part.position.z=this.sz+this._rand.generate(this._spreadDtls.posMin.z,this._spreadDtls.posMax.z);
            part.position.y=(this._groundMesh).getHeightAtCoordinates(part.position.x,part.position.z);
            part.position.y=part.position.y+this._rand.generate(this._spreadDtls.posMin.y,this._spreadDtls.posMax.y);

            //scale
            part.scaling.x=this._rand.generate(this._spreadDtls.sclMin.x,this._spreadDtls.sclMax.x);
            part.scaling.y=this._rand.generate(this._spreadDtls.sclMin.y,this._spreadDtls.sclMax.y);
            part.scaling.z=this._rand.generate(this._spreadDtls.sclMin.z,this._spreadDtls.sclMax.z);

            //rotation
            part.rotation.x=this._rand.generate(this._spreadDtls.rotMin.x,this._spreadDtls.rotMax.x);
            part.rotation.y=this._rand.generate(this._spreadDtls.rotMin.y,this._spreadDtls.rotMax.y);
            part.rotation.z=this._rand.generate(this._spreadDtls.rotMin.z,this._spreadDtls.rotMax.z);


            this.sx=this.sx+this._spreadDtls.step;
            if(this.sx>this.sXmax) {
                this.sx=this.sXmin;
                this.sz=this.sz-this._spreadDtls.step;
            }
        }
    }
    
    export interface GroundSPSserialized{
         meshID: string;
         groundMeshID: string;
         spreadDtls:SpreadDtls;
    }
    
    export interface SpreadDtls{
         seed:number;
         step?:number;
         sprdMin?:Vector2;
         sprdMaxn?:Vector2;
         posRange?: number;
         sclRange?: number;
         rotRange?: number;
         posMin?: Vector3;
         posMax?: Vector3;
         sclMin?: Vector3;
         sclMax?: Vector3;
         rotMin?: Vector3;
         rotMax?: Vector3;
    }
}


