# Moving to the RadioMaster GX10

The plan for replacing the TX16S with a RadioMaster GX10, written on 16 November 2026 before buying it.

## The link: keep FrSky, add a Nano 4-in-1

The M2 EVO flies on a FrSky R-XSR receiver (ACCST D16 v2.1, LBT EU) wired to the flight controller over SBUS, with
OriginHobbies' Juice Gauge on the power lead: a FrSky FAS40 ADV inside, sending VFAS and Curr over SmartPort (ID 0x22).
The TX16S drives it through its internal 4-in-1 module, Multi protocol FrSky X2, LBT (EU).

The GX10's internal module is ExpressLRS only, and no ELRS receiver reads the Juice Gauge (SmartPort and FBUS only,
and discontinued). So a 4-in-1 module goes in the GX10's back bay, which takes Nano modules: the R-XSR and the Juice
Gauge stay as they are, the sensors keep their names, and the K110S (Futaba S-FHSS, built-in receiver) binds too.

| Module                     | Price seen (Nov 2026)                       | Fit                                                                   |
| -------------------------- | ------------------------------------------- | --------------------------------------------------------------------- |
| iRangeX IRX4 Lite          | £47.80 at Flying Tech, about $32 Banggood   | Made for FrSky's Lite bay, the same small bay: not yet seen in a GX10 |
| RadioMaster RM 4IN1 (Nano) | $59.99 at RadioMaster, €72 to €80 in the EU | Made for RadioMaster's Nano bay                                       |

Both only need their CC2500 chip here (FrSky X2 and S-FHSS). Used ones sell for €20 to €35.

Will the IRX4 Lite work in the GX10 (checked 16 Nov 2026)? Very likely; only the physical fit is unproven:

- EdgeTX builds the GX10 with Multi module support on and an external module with its send, receive and telemetry
  lines (`targets/gx10`), and marks its bay "small" (`MODULE_SIZE_SML`), as on the FrSky X9 Lite and X-Lite (the radios
  the IRX4 Lite was made for) and the RadioMaster Pocket, Zorro and MT12 (Nano bay).
- Shops sell Nano and Lite modules as one size (BetaFPV's adapter: "Nano module bay (Lite module bay)"), and Flying
  Tech's questions and answers say that the IRX4 Lite works in the Pocket and other RadioMaster Nano bays with EdgeTX.
- The Multi project lists the IRX4 Lite as a genuine module. It warns against the Vantac MPM Lite and URUAV TMX5 Lite
  (the wrong processor): avoid those, however cheap.
- No one has reported one in a GX10 yet (it is only just out, still on pre-order at RadioMaster), and the GX10's bay
  cover is bolted: buy it where it can go back, and try it with the cover on.

Going ELRS instead would lose the current, and with it the mAh count, the fuel gauge, the amps and power readouts and
the low battery alarm (it counts only under load): an ER6 or Matek R24-P6 on the SBUS port gives the pack voltage only.

## What changes for the models and widgets

Both radios run EdgeTX 2.12 with the same Lua API, and the GX10 has a vibration motor. Its controls (EdgeTX's
`gx10.json`): SA, SD (momentary, on top), SG, SH (momentary, at the back), SB, SC, SE, SF (3 positions), SW1 to SW6
(the RGB buttons), sliders S1 and S2, no 6-position switch; a 320 × 240 screen.

| What                              | Effort | Change                                                                                |
| --------------------------------- | ------ | ------------------------------------------------------------------------------------- |
| Mixes, timers, sounds             | None   | The mixes only read logical switches                                                  |
| SC gyro, SE idle up, SH rescue    | None   | Same names (SH is a back momentary, as now)                                           |
| SF hold                           | None   | 3 positions on the GX10: use its two ends                                             |
| Arming on SA                      | Small  | SA is a momentary on the GX10: arm on SB (model, sounds, switch warning, widgets)     |
| K110S Low RPM on SB               | Small  | SB arms on the GX10: Low RPM moves to a SW button                                     |
| The link                          | Small  | Internal module off, Multi FrSky X2 LBT (EU) on the external module                   |
| Pack buttons (`6pos`, P2 in logs) | Medium | SW1 to SW6 as one group: widgets, logs and Flightdown's log import read them          |
| Cockpit widget                    | Big    | Drawn for 480 × 227 with fixed panel pictures: a new layout for 320 × 240             |
| Other widgets, top bar            | Check  | They size to their zone, but the top bar is narrower: Timers and FMStatus may not fit |
| Deploy                            | Small  | The GX10's drive (512 MB inside, an SD card turns it off); never copy `radio.yml`     |
| Flightdown's Radio tab            | Medium | A 320 × 240 GX10 screen beside the TX16S one                                          |

## Checklist

Before buying:

- [x] Find out what is in the M2 EVO: an R-XSR and a Juice Gauge.
- [x] Check the IRX4 Lite works in the GX10: very likely, only its fit is unproven (see above).
- [ ] Check a Nano 4-in-1 is in stock (IRX4 Lite from a shop that takes returns, or the RM 4IN1).
- [ ] Buy the GX10 (the MAX has AG01 gimbals, as the TX16S), two 18650 cells and the 4-in-1.

In this repo and Flightdown, before it arrives:

- [ ] A `gx10` branch: the arming on SB, the pack picked with SW1 to SW6, the Cockpit drawn again for 320 × 240, the
      other widgets checked at the GX10's zone sizes and in its top bar.
- [ ] Model scripts for the GX10: SA to SB, the link on the external module, SW1 to SW6 as a group; `six_pos.py` and the
      TX16S top bar zones left out of its deploy.
- [ ] `deploy.sh` pointed at the GX10's drive.
- [ ] Flightdown: the pack read from SW1 to SW6 (P2 kept for the old logs), and a GX10 screen in the Radio tab.

When the radio arrives:

- [ ] Update it to EdgeTX 2.12.5 (as the TX16S) or later, fit the 4-in-1 and update its Multi firmware.
- [ ] Deploy, then set SW1 to SW6 as one group, one always on.
- [ ] Bind the M2 EVO: the R-XSR's button held while the pack goes in, then bind from the radio; its blue LED steady
      (SBUS mode).
- [ ] Bind the K110S on Futaba S-FHSS.
- [ ] Discover the sensors, then `sensor_ids.py` so VFAS, Curr and mAh are back in their slots.
- [ ] On the bench, blades off: arming, hold, idle ups, gyro, rescue, failsafe (no pulses), the low battery buzz, the
      logs.
- [ ] A hover, then the first logs into Flightdown.

Before selling the TX16S:

- [ ] Its whole card into `backups/`.
- [ ] A factory reset; in Flightdown, the GX10 added and the TX16S marked sold with its price.

## Sources

- [M2 Juice Gauge user guide](https://originhobbies.com/m2-juice-gauge-telemetry-user-guide/) and
  [product page](https://originhobbies.com/shop/radio-control/radio-receivers/frsky-protocol/m2-juice-gauge-telemetry-set-battery-voltage-and-current-sensor/)
  (OriginHobbies)
- [ELRS on the M1 and M2](https://originhobbies.com/expresslrs-sbus-with-omphobby-m1-m2-helicopter/) (OriginHobbies):
  the original M2 EVO takes ELRS over SBUS only
- GX10 reviews: [Oscar Liang](https://oscarliang.com/radiomaster-gx10/),
  [RC-SOAR](https://rc-soar.blogspot.com/2026/11/radiomaster-gx10-review.html) (the Nano bay, SA and SD momentary)
- [EdgeTX's GX10 hardware definition](https://github.com/EdgeTX/edgetx/blob/main/radio/src/boards/hw_defs/gx10.json)
- [MULTI-Module hardware](https://www.multi-module.org/basics/module-hardware) (genuine modules and the clones to avoid),
  [BetaFPV Nano/Lite adapter](https://betafpv.com/products/micro-nano-module-adapter)
- [iRangeX IRX4 Lite at Flying Tech](https://www.flyingtech.co.uk/product/irangex-irx4-lite-2-4ghz-4-in-1-stm32-multiprotocol-tx-module/),
  [RadioMaster RM 4IN1](https://radiomasterrc.com/products/rm-4in1-module)
