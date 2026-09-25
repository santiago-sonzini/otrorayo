---
background: '#000000'
foreground: '#f4f7ff'
font: Space Grotesk
red: '#ee3825'
orange: '#ff6b0b'
yellow: '#fec306'
green: '#77bd20'
blue: '#188ad9'
---

# Cinco corrientes. Un signo.

Negro sin horizonte. Sólo la bienvenida, filamentos espaciales y el signo auténtico. El encuadre del video coincide con una cámara a altura ocular fija, mirando al frente; 58° verticales y 16:9. La vista de revisión permite mirar alrededor aparte de esa cámara de entrega.

La única fuente tipográfica es la entregada por el usuario. La bienvenida ocupa un plano a 2,8 m; la firma pequeña está por debajo. Nada de HUD, etiquetas de producción o controles dentro del video.

La marca ocupa 2,4 m de alto y queda a 4,5 m del espectador. Extrusión 0,12 m, bisel 0,007 m. El símbolo conserva dos hojas desplazadas y cortes del círculo. Reflejos blancos dominantes, aristas frías, cinco láminas discretas de color. Shader óptico de entorno analítico: aproximación económica, sin caústicas ni path tracing.

El túnel tiene un área central despejada de radio 1,6 m; cuando se comprime, toda la geometría se aleja hacia el plano del logo. El horizonte no gira. Las corrientes tienen pocos filamentos principales, acompañados de trazos finos; negro entre ellos, halos contenidos sin bloom de pantalla completa.

Reglas de movimiento: sine-wave-loop para curvatura longitudinal estable; depth-scatter-assemble para convergencia de volumen hacia los contornos; ambient-glow-bloom para reflejo viajero y halos contenidos. Se adaptan como funciones puras de tiempo del adaptador Three.js, conservando posiciones oculares fijas. Una única toma continua, sin cortes entre los cuatro momentos del storyboard.
