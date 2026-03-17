import mongoose,{Schema,model,models} from "mongoose"
const ServiceSchema= new Schema(
  {
    name:{type: String,required: true,trim:true},
    price:{type: Number,required:true,min: 0},
    durationMin:{type:Number,required:true,min:5},
    isActive:{type:Boolean,default:true},

  },
  {
    timestamps: true,
  }
);
export const Service= models.Service|| model("Service",ServiceSchema)