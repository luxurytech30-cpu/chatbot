import mongoose, {Schema,model,models} from "mongoose"

const BarberSchema= new Schema(
  {
    name:{type:String,required:true,trim:true},
    isActive:{type:Boolean,default:true},
    worksDays:{type:[Number],default:[0,1,2,3,4,5]}
  },
  {timestamps:true}
);
export const Barber= models.Barbers || model("Barber",BarberSchema);