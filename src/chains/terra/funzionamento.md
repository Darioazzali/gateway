Come funziona?

1. Il programma parte e chiama startGateway().    
2. La funzione chiama il metodo getIstance del [ConfigManager](../../../src/services/config-manager-v2.ts) per cercare la porta dell'applicazione.    
3.  Non appena chiamato il metodo il config manager cerca un istanziazione della classe, se non la trova crea una istanza di se stesso passando al costruttore il
[root.yml](../../../conf/root.yml) 
4. Quando viene inizializzato il costruttore crea uno spazio vuoto di namespaces e carica le configurazioni del root tramite il metodo loadConfigRoot.


### LoadConfigRoot

1. Carica gli yml template ed il full path
2. Effettua un check sulla versione dei file, se trova una nuova fa la migrazione.
3. Effettua una validazione del config root file
