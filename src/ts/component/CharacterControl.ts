
namespace org.ssatguru.babylonjs.component {

    import Skeleton = BABYLON.Skeleton;
    import ArcRotateCamera = BABYLON.ArcRotateCamera;
    import Vector3 = BABYLON.Vector3;
    import Mesh = BABYLON.Mesh;
    import Scene = BABYLON.Scene;

    export class CharacterControl {

        avatarSkeleton: Skeleton;
        camera: ArcRotateCamera;
        avatar: Mesh;
        key: Key;
        scene: Scene;
        //slopeLimit in degrees
        slopeLimit: number = 30;
        maxSlopeLimit: number = 45;
        //slopeLimit in radians
        sl: number = Math.PI * this.slopeLimit / 180;
        sl2: number = Math.PI * this.maxSlopeLimit / 180;
        private renderer: () => void;

        constructor(avatar: Mesh, avatarSkeleton: Skeleton, anims: AnimData[], camera: ArcRotateCamera, scene: Scene) {

            this.avatarSkeleton = avatarSkeleton;
            if (anims !== null) this.initAnims(anims);
            this.camera = camera;

            this.avatar = avatar;
            this.scene = scene;
            this.key = new Key();

            window.addEventListener("keydown", (e) => {return this.onKeyDown(e)}, false);
            window.addEventListener("keyup", (e) => {return this.onKeyUp(e)}, false);
            this.renderer = () => {this.moveAVandCamera()};

        }



        public setAvatar(avatar: Mesh) {
            this.avatar = avatar;
        }

        public setAvatarSkeleton(avatarSkeleton: Skeleton) {
            this.avatarSkeleton = avatarSkeleton;
        }

        public setAnims(anims: AnimData[]) {
            this.initAnims(anims);
        }

        public setSlopeLimit(slopeLimit: number) {
            this.slopeLimit = slopeLimit;
            this.sl = Math.PI * slopeLimit / 180;
        }

        public setWalkSpeed(n: number) {
            this.walkSpeed = n;
        }
        public setRunSpeed(n: number) {
            this.runSpeed = n;
        }
        public setBackSpeed(n: number) {
            this.backSpeed = n;
        }
        public setJumpSpeed(n: number) {
            this.jumpSpeed = n;
        }
        public setLeftSpeed(n: number) {
            this.leftSpeed = n;
        }
        public setRightSpeed(n: number) {
            this.rightSpeed = n;
        }

        private started: boolean = false;

        public start() {
            if (this.started) return;
            this.started = true;
            this.key.reset();
            this.movFallTime = 0;
            //first time we enter render loop, delta time shows zero !!
            this.idleFallTime = 0.001;
            this.grounded = false;
            this.updateTargetValue();

            this.scene.registerBeforeRender(this.renderer);
            //this.scene.registerAfterRender(this.afterRenderer);
            this.scene
        }

        public stop() {
            if (!this.started) return;
            this.started = false;
            this.scene.unregisterBeforeRender(this.renderer);
        }

        private walk: AnimData;
        private walkBack: AnimData;
        private slideBack: AnimData;
        private idle: AnimData;
        private run: AnimData;
        private jump: AnimData;
        private fall: AnimData;
        private turnLeft: AnimData;
        private turnRight: AnimData;
        private strafeLeft: AnimData;
        private strafeRight: AnimData;

        private initAnims(anims: AnimData[]) {
            this.walk = anims[0];
            this.walkBack = anims[1];
            this.idle = anims[2];
            this.idle.r = 0.5;
            this.run = anims[3];
            this.jump = anims[4];
            this.jump.r = 4;
            this.jump.l = false;
            this.fall = anims[5];
            this.fall.l = false;
            this.turnLeft = anims[6];
            this.turnRight = anims[7];
            this.strafeLeft = anims[8];
            this.strafeRight = anims[9];
            this.slideBack = anims[10];
        }

        //avatar walking speed in meters/second
        private walkSpeed: number = 3;
        private runSpeed: number = this.walkSpeed * 2;
        private backSpeed: number = this.walkSpeed / 2;
        private jumpSpeed: number = this.walkSpeed * 2;
        private leftSpeed: number = this.walkSpeed / 2;
        private rightSpeed: number = this.walkSpeed / 2;

        private prevAnim: AnimData = null;
        private gravity: number = 9.8;
        private avStartPos: Vector3 = new Vector3(0, 0, 0);
        private grounded: boolean = false;
        //distance by which AV would move down if in freefall
        private freeFallDist: number = 0;

        //how many minimum contiguos frames should the AV have been in free fall
        //before we assume AV is in big freefall.
        //we will use this to remove animation flicker during move down a slope (fall, move, fall move etc)
        //TODO: base this on slope - large slope large count
        private fallFrameCountMin: number = 50;
        private fallFrameCount: number = 0;

        private inFreeFall: boolean = false;
        private wasWalking: boolean = false;
        private wasRunning: boolean = false;
        private moveVector: Vector3;

        private moveAVandCamera() {
            this.avStartPos.copyFrom(this.avatar.position);
            let anim: AnimData = null;
            let dt: number = this.scene.getEngine().getDeltaTime() / 1000;
            
            if (this.key.jump && !this.inFreeFall) {
                this.grounded = false;
                this.idleFallTime = 0;

                anim = this.doJump(dt);
            } else if (this.anyMovement() || this.inFreeFall) {
                this.grounded = false;
                this.idleFallTime = 0;

                anim = this.doMove(dt);
            } else if (!this.inFreeFall) {

                anim = this.doIdle(dt);
            }

            if (anim != null) {
                if (this.avatarSkeleton !== null) {
                    if (this.prevAnim !== anim) {
                        if (anim.exist) {
                            this.avatarSkeleton.beginAnimation(anim.name, anim.l, anim.r);
                        }
                        this.prevAnim = anim;
                    }
                }
            }
            this.updateTargetValue();
            return;
        }

        //verical position of AV when it is about to start a jump
        private jumpStartPosY: number = 0;
        //for how long the AV has been in the jump
        private jumpTime: number = 0;
        private doJump(dt: number): AnimData {

            let anim: AnimData = null;
            anim = this.jump;
            if (this.jumpTime === 0) {
                this.jumpStartPosY = this.avatar.position.y;
            }
            //up velocity at the begining of the lastt frame (v=u+at)
            let js: number = this.jumpSpeed - this.gravity * this.jumpTime;
            //distance travelled up since last frame to this frame (s=ut+1/2*at^2)
            let jumpDist: number = js * dt - 0.5 * this.gravity * dt * dt;
            this.jumpTime = this.jumpTime + dt;

            let forwardDist: number = 0;
            let disp: Vector3;
            this.avatar.rotation.y = -4.69 - this.camera.alpha;
            if (this.wasRunning || this.wasWalking) {
                if (this.wasRunning) {
                    forwardDist = this.runSpeed * dt;
                } else if (this.wasWalking) {
                    forwardDist = this.walkSpeed * dt;
                }
                //find out in which horizontal direction the AV was moving when it started the jump
                disp = this.moveVector.clone();
                disp.y = 0;
                disp = disp.normalize();
                disp.scaleToRef(forwardDist, disp);
                disp.y = jumpDist;
            } else {
                disp = new Vector3(0, jumpDist, 0);
            }
            //moveWithCollision only seems to happen if length of displacment is atleast 0.001
            this.avatar.moveWithCollisions(disp);
            if (jumpDist < 0) {
                anim = this.fall;
                //check if going up a slope or back on flat ground 
                if ((this.avatar.position.y > this.avStartPos.y) || ((this.avatar.position.y === this.avStartPos.y) && (disp.length() > 0.001))) {
                    this.endJump();
                } else if (this.avatar.position.y < this.jumpStartPosY) {
                    //the avatar is below the point from where it started the jump
                    //so it is either in free fall or is sliding along a downward slope
                    //
                    //if the actual displacemnt is same as the desired displacement then AV is in freefall
                    //else it is on a slope
                    let actDisp: Vector3 = this.avatar.position.subtract(this.avStartPos);
                    if (!(this.areVectorsEqual(actDisp, disp, 0.001))) {
                        //AV is on slope
                        //Should AV continue to slide or stop?
                        //if slope is less steeper than acceptable then stop else slide
                        if (this.verticalSlope(actDisp) <= this.sl) {
                            this.endJump();
                        }
                    }
                }
            }
            return anim;
        }

        /**
         * does cleanup at the end of a jump
         */
        private endJump() {
            this.key.jump = false;
            this.jumpTime = 0;
            this.wasWalking = false;
            this.wasRunning = false;
        }

        /**
         * checks if two vectors v1 and v2 are equal with an equality precision of p
         */
        private areVectorsEqual(v1: Vector3, v2: Vector3, p: number) {
            return ((Math.abs(v1.x - v2.x) < p) && (Math.abs(v1.y - v2.y) < p) && (Math.abs(v1.z - v2.z) < p));
        }
        /*
         * returns the slope (in radians) of a vector in the vertical plane
         */
        private verticalSlope(v: Vector3): number {
            return Math.atan(Math.abs(v.y / Math.sqrt(v.x * v.x + v.z * v.z)));
        }

        //for how long has the av been falling while moving
        private movFallTime: number = 0;

        private doMove(dt: number): AnimData {

            //initial down velocity
            let u: number = this.movFallTime * this.gravity
            //calculate the distance by which av should fall down since last frame
            //assuming it is in freefall
            this.freeFallDist = u * dt + this.gravity * dt * dt / 2;

            this.movFallTime = this.movFallTime + dt;

            let moving: boolean = false;
            let anim: AnimData = null;

            if (this.inFreeFall) {
                this.moveVector.y = -this.freeFallDist;
                moving = true;
            } else {
                this.wasWalking = false;
                this.wasRunning = false;

                if (this.key.forward) {
                    let forwardDist: number = 0;
                    if (this.key.shift) {
                        this.wasRunning = true;
                        forwardDist = this.runSpeed * dt;
                        anim = this.run;
                    } else {
                        this.wasWalking = true;
                        forwardDist = this.walkSpeed * dt;
                        anim = this.walk;
                    }
                    this.moveVector = this.avatar.calcMovePOV(0, -this.freeFallDist, forwardDist);
                    moving = true;
                } else if (this.key.backward) {
                    this.moveVector = this.avatar.calcMovePOV(0, -this.freeFallDist, -(this.backSpeed * dt));
                    anim = this.walkBack;
                    moving = true;
                } else if (this.key.stepLeft) {
                    anim = this.strafeLeft;
                    this.moveVector = this.avatar.calcMovePOV(-(this.leftSpeed * dt), -this.freeFallDist, 0);
                    moving = true;
                } else if (this.key.stepRight) {
                    anim = this.strafeRight;
                    this.moveVector = this.avatar.calcMovePOV((this.rightSpeed * dt), -this.freeFallDist, 0);
                    moving = true;
                }
            }

            if (!this.key.stepLeft && !this.key.stepRight) {
                if (this.key.turnLeft) {
                    this.camera.alpha = this.camera.alpha + 0.022;
                    if (!moving) {
                        this.avatar.rotation.y = -4.69 - this.camera.alpha;
                        anim = this.turnLeft;
                    }
                } else if (this.key.turnRight) {
                    this.camera.alpha = this.camera.alpha - 0.022;
                    if (!moving) {
                        this.avatar.rotation.y = -4.69 - this.camera.alpha;
                        anim = this.turnRight;
                    }
                }
            }

            if (moving) {
                this.avatar.rotation.y = -4.69 - this.camera.alpha;

                if (this.moveVector.length() > 0.001) {
                    this.avatar.moveWithCollisions(this.moveVector);
                    //walking up a slope
                    if (this.avatar.position.y > this.avStartPos.y) {
                        let actDisp: Vector3 = this.avatar.position.subtract(this.avStartPos);
                        if (this.verticalSlope(actDisp) > this.sl2) {
                            this.avatar.position.copyFrom(this.avStartPos);
                            this.endFreeFall();
                        } if (this.verticalSlope(actDisp) < this.sl) {
                            this.endFreeFall();
                        } else {
                            //av is on a steep slope , continue increasing the moveFallTIme to deaccelerate it
                            this.fallFrameCount = 0;
                            this.inFreeFall = false;
                        }
                    } else if ((this.avatar.position.y) < this.avStartPos.y) {
                        let actDisp: Vector3 = this.avatar.position.subtract(this.avStartPos);
                        if (!(this.areVectorsEqual(actDisp, this.moveVector, 0.001))) {
                            //AV is on slope
                            //Should AV continue to slide or walk?
                            //if slope is less steeper than acceptable then walk else slide
                            if (this.verticalSlope(actDisp) <= this.sl) {
                                this.endFreeFall();
                            } else {
                                //av is on a steep slope , continue increasing the moveFallTIme to deaccelerate it
                                this.fallFrameCount = 0;
                                this.inFreeFall = false;
                            }
                        } else {
                            this.inFreeFall = true;
                            this.fallFrameCount++;
                            //AV could be running down a slope which mean freefall,run,frefall run ...
                            //to remove anim flicker, check if AV has been falling down continously for last few consecutive frames
                            //before changing to free fall animation
                            if (this.fallFrameCount > this.fallFrameCountMin) {
                                anim = this.fall;
                            }
                        }
                    } else {
                        this.endFreeFall();
                    }
                }
            }
            return anim;
        }

        private endFreeFall(): void {
            this.movFallTime = 0;
            this.fallFrameCount = 0;
            this.inFreeFall = false;
        }

        //for how long has the av been falling while idle (not moving)
        private idleFallTime: number = 0;
        private doIdle(dt: number): AnimData {
            if (this.grounded) {
                return this.idle;
            }
            let anim: AnimData = this.idle;
            this.fallFrameCount = 0;
            this.movFallTime = 0;

            if (dt === 0) {
                this.freeFallDist = 5;
            } else {
                let u: number = this.idleFallTime * this.gravity
                this.freeFallDist = u * dt + this.gravity * dt * dt / 2;
                this.idleFallTime = this.idleFallTime + dt;
            }
            //if displacement is less than 0.01(? need to verify further) then 
            //moveWithDisplacement down against a surface seems to push the AV up by a small amount!!
            if (this.freeFallDist < 0.01) return anim;
            let disp: Vector3 = new Vector3(0, -this.freeFallDist, 0);;
            this.avatar.rotation.y = -4.69 - this.camera.alpha;
            this.avatar.moveWithCollisions(disp);
            if ((this.avatar.position.y > this.avStartPos.y) || (this.avatar.position.y === this.avStartPos.y)) {
//                this.grounded = true;
//                this.idleFallTime = 0;
                this.groundIt();
            } else if (this.avatar.position.y < this.avStartPos.y) {
                //AV is going down. 
                //AV is either in free fall or is sliding along a downward slope
                //
                //if the actual displacemnt is same as the desired displacement then AV is in freefall
                //else it is on a slope
                let actDisp: Vector3 = this.avatar.position.subtract(this.avStartPos);
                if (!(this.areVectorsEqual(actDisp, disp, 0.001))) {
                    //AV is on slope
                    //Should AV continue to slide or stop?
                    //if slope is less steeper than accebtable then stop else slide
                    if (this.verticalSlope(actDisp) <= this.sl) {
//                        this.grounded = true;
//                        this.idleFallTime = 0;
                        this.groundIt();
                        this.avatar.position.copyFrom(this.avStartPos);
                    } else {
                        this.unGroundIt();
                        anim = this.slideBack;
                    }
                }
            }
            return anim;
        }
        
        private groundFrameCount=0;
        private groundFrameMax=10;
        /**
         * donot ground immediately
         * wait few more frames
         */
        private groundIt():void{
            this.groundFrameCount++;
            if (this.groundFrameCount > this.groundFrameMax){
                this.grounded = true;
                this.idleFallTime = 0;
            }
        }
        private unGroundIt(){
            this.grounded = false;
            this.groundFrameCount=0;
        }

        



        private updateTargetValue() {
            this.camera.target.copyFromFloats(this.avatar.position.x, (this.avatar.position.y + 1.5), this.avatar.position.z);
        }

        move: boolean = false;
        private onKeyDown(e: Event) {

            var event: KeyboardEvent = <KeyboardEvent> e;
            var chr: string = String.fromCharCode(event.keyCode);

            if (event.keyCode === 32) {
                //if (!this.isJumping) this.key.jump = true;
                this.key.jump = true;
            } else if (event.keyCode === 16) this.key.shift = true;
            //WASD or arrow keys
            else if ((chr === "W") || (event.keyCode === 38)) this.key.forward = true;
            else if ((chr === "A") || (event.keyCode === 37)) this.key.turnLeft = true;
            else if ((chr === "D") || (event.keyCode === 39)) this.key.turnRight = true;
            else if ((chr === "S") || (event.keyCode === 40)) this.key.backward = true;
            else if (chr === "Q") this.key.stepLeft = true;
            else if (chr === "E") this.key.stepRight = true;
            this.move = this.anyMovement();

        }

        public anyMovement(): boolean {
            return (this.key.forward || this.key.backward || this.key.turnLeft || this.key.turnRight || this.key.stepLeft || this.key.stepRight);
        }

        private onKeyUp(e: Event) {

            var event: KeyboardEvent = <KeyboardEvent> e;
            var chr: string = String.fromCharCode(event.keyCode);

            if (event.keyCode === 32) {
                //if (!this.isJumping) this.key.jump = true;
            } else if (event.keyCode === 16) {this.key.shift = false;}
            //WASD or arrow keys
            else if ((chr === "W") || (event.keyCode === 38)) this.key.forward = false;
            else if ((chr === "A") || (event.keyCode === 37)) this.key.turnLeft = false;
            else if ((chr === "D") || (event.keyCode === 39)) this.key.turnRight = false;
            else if ((chr === "S") || (event.keyCode === 40)) this.key.backward = false;
            else if (chr === "Q") this.key.stepLeft = false;
            else if (chr === "E") this.key.stepRight = false;

            this.move = this.anyMovement();

        }

        //calc distance in horizontal plane
        private horizontalMove(v1: Vector3, v2: Vector3): number {
            let dx: number = v1.x - v2.x;
            let dz: number = v1.z - v2.z;
            let d: number = Math.sqrt(dx * dx + dz * dz);
            return d;

        }
    }

    export class AnimData {

        public name: string;
        //loop
        public l: boolean;
        //rate
        public r: number;
        public exist: boolean = false;

        public constructor(name: string, l: boolean, r: number) {
            this.name = name;
            this.l = l;
            this.r = r;
        }
    }

    export class Key {
        public forward: boolean;

        public backward: boolean;

        public turnRight: boolean;

        public turnLeft: boolean;

        public stepRight: boolean;

        public stepLeft: boolean;

        public jump: boolean;

        public shift: boolean;


        constructor() {
            this.forward = false;
            this.backward = false;
            this.turnRight = false;
            this.turnLeft = false;
            this.stepRight = false;
            this.stepLeft = false;
            this.jump = false;
            this.shift = false;
        }

        reset() {
            this.forward = false;
            this.backward = false;
            this.turnRight = false;
            this.turnLeft = false;
            this.stepRight = false;
            this.stepLeft = false;
            this.jump = false;
            this.shift = false;
        }
    }
}
