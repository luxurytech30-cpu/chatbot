import mongoose ,{models,model, Schema} from "mongoose";
const AppointmentSchema=new Schema(
  {
  waId:{type:String,required:true},
  customerName:{type:String,required:true},
  serviceId:{
    type:Schema.Types.ObjectId,
    ref:"Service",
    required:true
  },
  barberId:{
    type:Schema.Types.ObjectId,
    ref:"Barber",
    required:true,
  },
  date:{type:String,requierd:true},
  time:{type:String, requierd:true},
  status:{
    type:String,
    enum:["booked","cancelled","done"],
    default:"booked"
  },
  source:{
    type:String,
    enum:["bot","admin"],
    default:"bot",
  },
},
{
  timestamps:true,
}

);
AppointmentSchema.index(
{barberId:1,date:1,time:1,status:1},
{unique:true,partialFilterExpression:{status:"booked"}}
);
export const Appointment=models.Appointment || model("Appointment",AppointmentSchema);