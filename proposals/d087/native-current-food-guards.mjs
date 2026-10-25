// D087 finite current contract. Original proposals/d086/current-food-guards.mjs is unchanged at b4275bda73e72a9fb48343376fccaab52bbc8e84.
import {d055NativeGuards} from '../../tools/unit-d055-native-d087.mjs';let failed=0;await d055NativeGuards((ok,n,d)=>{console.log(ok?'OK':'NG',n,d??'');if(!ok)failed++;});if(failed)process.exitCode=1;
