// D090 finite current contract. Original proposals/d089/native-current-food-guards.mjs remains byte-exact at 5b41bac165ba2b29146e6835490357bebc3cd549.
// D089 finite current contract. Original proposals/d088/native-current-food-guards.mjs remains byte-exact at c023a2da0e4999d43e3d4216e800c4c96d06a3c1.
// D088 finite current contract. Original proposals/d087/native-current-food-guards.mjs remains byte-exact at cdd541da74973dba2ca73b782936c012d315add9.
// D087 finite current contract. Original proposals/d086/current-food-guards.mjs is unchanged at b4275bda73e72a9fb48343376fccaab52bbc8e84.
import {d055NativeGuards} from '../../tools/unit-d055-native-d090.mjs';let failed=0;await d055NativeGuards((ok,n,d)=>{console.log(ok?'OK':'NG',n,d??'');if(!ok)failed++;});if(failed)process.exitCode=1;
